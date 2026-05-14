// ==========================================
// js/app.js - Plato App (with filter buttons and modal)
// ==========================================

import { openDB, getAllMovies, saveMovie, toggleWatching } from './db.js';
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

// Filter buttons
const filterWatchingBtn = document.getElementById('filterWatchingBtn');
const filterFavoriteBtn = document.getElementById('filterFavoriteBtn');

// ---------------------- Global state ----------------------
let dbReady = openDB();
let currentSearchChannelId = 'UCuVPpxrm2VAgpH3Ktln4HXg';
let currentDisplayChannelIds = ['UCuVPpxrm2VAgpH3Ktln4HXg'];

let activeWatchingFilter = false;
let activeFavoriteFilter = false;

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

// ---------------------- Build Search In panel ----------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    function setExclusive(clickedCheckbox) {
        const all = searchInPanel.querySelectorAll('input[type="checkbox"]');
        all.forEach(cb => {
            cb.checked = (cb === clickedCheckbox);
        });
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

    // Real channels
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

// ---------------------- Build Show Channels panel ----------------------
function buildShowChannelsPanel() {
    showChannelsPanel.innerHTML = '';

    function closeThisPanelWithDelay() {
        setTimeout(() => {
            showChannelsPanel.classList.add('hidden');
        }, 150);
    }

    function ensureAtLeastOneChecked() {
        const allCheckboxes = showChannelsPanel.querySelectorAll('input[type="checkbox"]');
        const anyChecked = Array.from(allCheckboxes).some(cb => cb.checked);
        if (!anyChecked) {
            const allCb = showChannelsPanel.querySelector('input[value=""]');
            if (allCb) {
                allCb.checked = true;
                currentDisplayChannelIds = [null];
                updateShowChannelsCheckboxes();
                loadAndDisplayAll();
            }
        }
    }

    // All Channels option
    const allLabel = document.createElement('label');
    const allCb = document.createElement('input');
    allCb.type = 'checkbox';
    allCb.value = '';
    allCb.checked = currentDisplayChannelIds.includes(null);
    allCb.addEventListener('change', () => {
        if (allCb.checked) {
            currentDisplayChannelIds = [null];
            updateShowChannelsCheckboxes();
            loadAndDisplayAll();
            closeThisPanelWithDelay();
        } else {
            const anyOtherChecked = Array.from(showChannelsPanel.querySelectorAll('input[type="checkbox"]'))
                .some(cb => cb !== allCb && cb.checked);
            if (!anyOtherChecked) {
                allCb.checked = true;
                return;
            }
            currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
            updateShowChannelsCheckboxes();
            loadAndDisplayAll();
            closeThisPanelWithDelay();
        }
        ensureAtLeastOneChecked();
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
                if (currentDisplayChannelIds.includes(null)) {
                    currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
                    updateShowChannelsCheckboxes();
                }
                if (!currentDisplayChannelIds.includes(channel.id)) {
                    currentDisplayChannelIds.push(channel.id);
                }
                loadAndDisplayAll();
                closeThisPanelWithDelay();
            } else {
                const allCb = showChannelsPanel.querySelector('input[value=""]');
                const remainingChecked = Array.from(showChannelsPanel.querySelectorAll('input[type="checkbox"]'))
                    .filter(c => c !== cb && c.checked);
                if (remainingChecked.length === 0 && (!allCb || !allCb.checked)) {
                    cb.checked = true;
                    return;
                }
                currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== channel.id);
                loadAndDisplayAll();
                closeThisPanelWithDelay();
            }
            ensureAtLeastOneChecked();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(channel.name));
        showChannelsPanel.appendChild(label);
    });

    ensureAtLeastOneChecked();
}

function updateShowChannelsCheckboxes() {
    const checkboxes = showChannelsPanel.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const val = cb.value === '' ? null : cb.value;
        cb.checked = currentDisplayChannelIds.includes(val);
    });
}

// ---------------------- Panel toggle logic ----------------------
searchInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (searchInPanel.classList.contains('hidden')) {
        showChannelsPanel.classList.add('hidden');
    }
    searchInPanel.classList.toggle('hidden');
});

showChannelsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (showChannelsPanel.classList.contains('hidden')) {
        searchInPanel.classList.add('hidden');
    }
    showChannelsPanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!searchInBtn.contains(e.target) && !searchInPanel.contains(e.target)) {
        searchInPanel.classList.add('hidden');
    }
    if (!showChannelsBtn.contains(e.target) && !showChannelsPanel.contains(e.target)) {
        showChannelsPanel.classList.add('hidden');
    }
});

// ---------------------- Filter buttons logic ----------------------
function updateFilterButtonsUI() {
    if (activeWatchingFilter) {
        filterWatchingBtn.classList.add('active');
    } else {
        filterWatchingBtn.classList.remove('active');
    }
    if (activeFavoriteFilter) {
        filterFavoriteBtn.classList.add('active');
    } else {
        filterFavoriteBtn.classList.remove('active');
    }
}

function toggleWatchingFilter() {
    activeWatchingFilter = !activeWatchingFilter;
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleFavoriteFilter() {
    activeFavoriteFilter = !activeFavoriteFilter;
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

if (filterWatchingBtn) filterWatchingBtn.addEventListener('click', toggleWatchingFilter);
if (filterFavoriteBtn) filterFavoriteBtn.addEventListener('click', toggleFavoriteFilter);

// ---------------------- Load and display movies (with filters) ----------------------
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies = await getAllMovies();

    if (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) {
        allMovies = allMovies.filter(movie => currentDisplayChannelIds.includes(movie.channelId));
    }

    if (activeWatchingFilter) {
        allMovies = allMovies.filter(movie => movie.watching === true);
    }
    if (activeFavoriteFilter) {
        allMovies = allMovies.filter(movie => movie.favorite === true);
    }

    renderMovies(resultsGrid, allMovies, `Movies (${allMovies.length})`);
}

// ---------------------- Modal-related functions ----------------------
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

// Expose modal opener for render.js
window.openMovieModal = (movie) => {
    openModal(movie, {
        updateMovieTerms,
        toggleWatching,   // from db.js
        toggleFavorite
    });
};

// ---------------------- Search ----------------------
searchBtn.onclick = async () => {
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
initModal(() => loadAndDisplayAll()); // refresh after modal changes
loadAndDisplayAll();

// Listen for watching toggles from cards to refresh filter view
window.addEventListener('watching-toggled', () => {
    if (activeWatchingFilter) {
        loadAndDisplayAll();
    }
});