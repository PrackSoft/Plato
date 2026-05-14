// ==========================================
// js/app.js - Plato App (with filter buttons, modal and trash)
// ==========================================

import { openDB, getAllMovies, getTrashMovies, saveMovie, toggleWatching, moveMovieToTrash, restoreMovieFromTrash, permanentlyDeleteMovie } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';
import { CHANNELS } from './channels.js';
import { initModal, openModal } from './modal.js';

// ---------------------- DOM elements ----------------------
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const searchInBtn = document.getElementById('searchInBtn');
const searchInPanel = document.getElementById('searchInPanel');
const showChannelsBtn = document.getElementById('showChannelsBtn');
const showChannelsPanel = document.getElementById('showChannelsPanel');

const filterWatchingBtn = document.getElementById('filterWatchingBtn');
const filterFavoriteBtn = document.getElementById('filterFavoriteBtn');
const filterTrashBtn = document.getElementById('filterTrashBtn');

// ---------------------- Global state ----------------------
let dbReady = openDB();
let currentSearchChannelId = 'UCuVPpxrm2VAgpH3Ktln4HXg';
let currentDisplayChannelIds = ['UCuVPpxrm2VAgpH3Ktln4HXg'];

let activeWatchingFilter = false;
let activeFavoriteFilter = false;
let activeTrashFilter = false;  // new

// ---------------------- Helper: close panels ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
    showChannelsPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => {
        panel.classList.add('hidden');
    }, 150);
}

// ---------------------- Build Search In panel (unchanged) ----------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    function setExclusive(clickedCheckbox) {
        const all = searchInPanel.querySelectorAll('input[type="checkbox"]');
        all.forEach(cb => cb.checked = (cb === clickedCheckbox));
        const checked = Array.from(all).find(cb => cb.checked);
        currentSearchChannelId = checked ? (checked.value === '' ? null : checked.value) : null;
        closePanelWithDelay(searchInPanel);
    }

    // All Channels
    const allLabel = document.createElement('label');
    const allCb = document.createElement('input');
    allCb.type = 'checkbox';
    allCb.value = '';
    allCb.checked = (currentSearchChannelId === null);
    allCb.addEventListener('change', () => {
        if (allCb.checked) setExclusive(allCb);
        else {
            const anyChecked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).some(cb => cb.checked);
            if (!anyChecked) {
                allCb.checked = true;
                setExclusive(allCb);
            } else {
                const checked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).find(cb => cb.checked);
                currentSearchChannelId = checked ? (checked.value === '' ? null : checked.value) : null;
                closePanelWithDelay(searchInPanel);
            }
        }
    });
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode('All Channels'));
    searchInPanel.appendChild(allLabel);

    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = channel.id;
        cb.checked = (currentSearchChannelId === channel.id);
        cb.addEventListener('change', () => {
            if (cb.checked) setExclusive(cb);
            else {
                const anyChecked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).some(c => c.checked);
                if (!anyChecked) {
                    const allCb2 = searchInPanel.querySelector('input[value=""]');
                    if (allCb2) {
                        allCb2.checked = true;
                        setExclusive(allCb2);
                    }
                } else {
                    const checked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).find(c => c.checked);
                    currentSearchChannelId = checked ? (checked.value === '' ? null : checked.value) : null;
                    closePanelWithDelay(searchInPanel);
                }
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(channel.name));
        searchInPanel.appendChild(label);
    });
}

// ---------------------- Build Show Channels panel (unchanged) ----------------------
function buildShowChannelsPanel() {
    showChannelsPanel.innerHTML = '';

    function closeThisPanelWithDelay() {
        setTimeout(() => showChannelsPanel.classList.add('hidden'), 150);
    }

    // Helper to update UI checkboxes from currentDisplayChannelIds
    function syncCheckboxes() {
        const checkboxes = showChannelsPanel.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const val = cb.value === '' ? null : cb.value;
            cb.checked = currentDisplayChannelIds.includes(val);
        });
    }

    // All Channels option
    const allLabel = document.createElement('label');
    const allCb = document.createElement('input');
    allCb.type = 'checkbox';
    allCb.value = '';
    allCb.checked = currentDisplayChannelIds.includes(null);
    allCb.addEventListener('change', () => {
        if (allCb.checked) {
            // Checked: set to [null] only
            currentDisplayChannelIds = [null];
            syncCheckboxes();
            loadAndDisplayAll();
            closeThisPanelWithDelay();
        } else {
            // Unchecking "All Channels": if no other channel is checked, prevent uncheck
            const anyOtherChecked = Array.from(showChannelsPanel.querySelectorAll('input[type="checkbox"]'))
                .some(cb => cb !== allCb && cb.checked);
            if (!anyOtherChecked) {
                allCb.checked = true; // keep it checked
                return;
            }
            // Remove null from array
            currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
            syncCheckboxes();
            loadAndDisplayAll();
            closeThisPanelWithDelay();
        }
    });
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode('All Channels'));
    showChannelsPanel.appendChild(allLabel);

    // Separator
    const sep = document.createElement('hr');
    sep.className = 'panel-separator';
    showChannelsPanel.appendChild(sep);

    // Real channels
    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = channel.id;
        cb.checked = currentDisplayChannelIds.includes(channel.id);
        cb.addEventListener('change', () => {
            if (cb.checked) {
                // Remove null (All Channels) if present
                if (currentDisplayChannelIds.includes(null)) {
                    currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
                }
                // Add this channel if not already present
                if (!currentDisplayChannelIds.includes(channel.id)) {
                    currentDisplayChannelIds.push(channel.id);
                }
                // Ensure at least one channel is selected (if no channel after adding? actually added one)
            } else {
                // Unchecking a real channel: remove it from array
                currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== channel.id);
                // If no channels left and "All Channels" is not checked, then check "All Channels"
                if (currentDisplayChannelIds.length === 0 && !allCb.checked) {
                    currentDisplayChannelIds = [null];
                    allCb.checked = true;
                }
            }
            syncCheckboxes();
            loadAndDisplayAll();
            closeThisPanelWithDelay();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(channel.name));
        showChannelsPanel.appendChild(label);
    });

    // Ensure consistency: if no channel selected and All Channels not checked, check All Channels
    if (currentDisplayChannelIds.length === 0 && !allCb.checked) {
        currentDisplayChannelIds = [null];
        allCb.checked = true;
    }
    syncCheckboxes();
}

function updateShowChannelsCheckboxes() {
    const checkboxes = showChannelsPanel.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const val = cb.value === '' ? null : cb.value;
        cb.checked = currentDisplayChannelIds.includes(val);
    });
}

// ---------------------- Panel toggle logic (unchanged) ----------------------
searchInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (searchInPanel.classList.contains('hidden')) showChannelsPanel.classList.add('hidden');
    searchInPanel.classList.toggle('hidden');
});

showChannelsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (showChannelsPanel.classList.contains('hidden')) searchInPanel.classList.add('hidden');
    showChannelsPanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!searchInBtn.contains(e.target) && !searchInPanel.contains(e.target)) searchInPanel.classList.add('hidden');
    if (!showChannelsBtn.contains(e.target) && !showChannelsPanel.contains(e.target)) showChannelsPanel.classList.add('hidden');
});

// ---------------------- Filter buttons logic (with trash) ----------------------
function updateFilterButtonsUI() {
    if (activeWatchingFilter) filterWatchingBtn.classList.add('active');
    else filterWatchingBtn.classList.remove('active');
    if (activeFavoriteFilter) filterFavoriteBtn.classList.add('active');
    else filterFavoriteBtn.classList.remove('active');
    if (activeTrashFilter) filterTrashBtn.classList.add('active');
    else filterTrashBtn.classList.remove('active');
}

function toggleWatchingFilter() {
    // If we are in trash view, exit trash first
    if (activeTrashFilter) {
        activeTrashFilter = false;
        updateFilterButtonsUI();
    }
    // Now toggle watching filter (if already active, deactivate; if inactive, activate)
    activeWatchingFilter = !activeWatchingFilter;
    // If watching filter becomes active, ensure favorite filter is off? (optional, but original behavior)
    if (activeWatchingFilter) {
        activeFavoriteFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleFavoriteFilter() {
    // Exit trash view if needed
    if (activeTrashFilter) {
        activeTrashFilter = false;
        updateFilterButtonsUI();
    }
    activeFavoriteFilter = !activeFavoriteFilter;
    if (activeFavoriteFilter) {
        activeWatchingFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleTrashFilter() {
    // Disable other filters when entering trash
    activeTrashFilter = !activeTrashFilter;
    if (activeTrashFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

if (filterWatchingBtn) filterWatchingBtn.addEventListener('click', toggleWatchingFilter);
if (filterFavoriteBtn) filterFavoriteBtn.addEventListener('click', toggleFavoriteFilter);
if (filterTrashBtn) filterTrashBtn.addEventListener('click', toggleTrashFilter);

// ---------------------- Load and display movies (with trash support) ----------------------
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies;

    if (activeTrashFilter) {
        // Load from trash, apply channel filter (currentDisplayChannelIds)
        let channelIds = (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) ? currentDisplayChannelIds : null;
        allMovies = await getTrashMovies(channelIds);
    } else {
        allMovies = await getAllMovies();
        if (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) {
            allMovies = allMovies.filter(movie => currentDisplayChannelIds.includes(movie.channelId));
        }
        if (activeWatchingFilter) allMovies = allMovies.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) allMovies = allMovies.filter(movie => movie.favorite === true);
    }

    renderMovies(resultsGrid, allMovies, activeTrashFilter ? `Trash (${allMovies.length})` : `Movies (${allMovies.length})`, activeTrashFilter ? 'trash' : 'main');
}

// ---------------------- Modal-related functions (now including trash functions) ----------------------
async function updateMovieTerms(youtubeId, newTerms) {
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    const movie = await new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (movie) {
        movie.searchTerms = newTerms;
        movie.lastUpdated = new Date().toISOString();
        await new Promise((resolve, reject) => {
            const req = store.put(movie);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}

async function toggleFavorite(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    const movie = await new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (movie) {
        movie.favorite = !movie.favorite;
        movie.lastUpdated = new Date().toISOString();
        await new Promise((resolve, reject) => {
            const req = store.put(movie);
            req.onsuccess = () => resolve(movie.favorite);
            req.onerror = () => reject(req.error);
        });
        return movie.favorite;
    }
    return false;
}

// Expose modal opener for render.js (now with trash functions)
window.openMovieModal = (movie, source = 'main') => {
    openModal(movie, {
        updateMovieTerms,
        toggleWatching,
        toggleFavorite,
        moveToTrash: moveMovieToTrash,
        restoreFromTrash: restoreMovieFromTrash,
        permanentlyDelete: permanentlyDeleteMovie
    }, source);
};

// ---------------------- Search ----------------------
searchBtn.onclick = async () => {
    if (activeTrashFilter) {
        // If in trash view, you may want to exit trash first? Or just ignore search.
        alert('Exit trash view to search.');
        return;
    }
    const query = searchInput.value.trim();
    if (!query) {
        resultsGrid.innerHTML = '<div class="stats">Enter a search term</div>';
        return;
    }
    const searchChannelId = currentSearchChannelId;
    resultsGrid.innerHTML = '<div class="stats">Searching...</div>';
    try {
        const moviesFromAPI = await searchYouTube(query, searchChannelId);
        if (moviesFromAPI.length === 0) {
            resultsGrid.innerHTML = '<div class="stats">No movies found</div>';
            return;
        }
        for (const movie of moviesFromAPI) {
            await saveMovie(movie, query);
        }
        await loadAndDisplayAll();
        searchInput.value = '';
    } catch (err) {
        console.error(err);
        resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
    }
};

// ---------------------- Initialization ----------------------
buildSearchInPanel();
buildShowChannelsPanel();
initModal(() => loadAndDisplayAll());
loadAndDisplayAll();

// Listen for watching toggles from cards to refresh filter view
window.addEventListener('watching-toggled', () => {
    if (activeWatchingFilter && !activeTrashFilter) {
        loadAndDisplayAll();
    }
});