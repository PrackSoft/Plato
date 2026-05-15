// ==========================================
// js/app.js - Plato App (with terms bar, filter buttons, modal and trash)
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
const termsBar = document.getElementById('termsBar');

// ---------------------- Global state ----------------------
let dbReady = openDB();
let currentSearchChannelId = 'UCuVPpxrm2VAgpH3Ktln4HXg';
let currentDisplayChannelIds = ['UCuVPpxrm2VAgpH3Ktln4HXg'];

let activeWatchingFilter = false;
let activeFavoriteFilter = false;
let activeTrashFilter = false;
let activeTermFilter = null;        // term string or null
let availableTerms = [];             // list of unique terms from all movies

let currentSort = 'date';   // default sort by date

// ---------------------- Helper: close panels ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
    showChannelsPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => panel.classList.add('hidden'), 150);
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
            currentDisplayChannelIds = [null];
            syncCheckboxes();
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
            syncCheckboxes();
            loadAndDisplayAll();
            closeThisPanelWithDelay();
        }
    });
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode('All Channels'));
    showChannelsPanel.appendChild(allLabel);

    const sep = document.createElement('hr');
    sep.className = 'panel-separator';
    showChannelsPanel.appendChild(sep);

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
                }
                if (!currentDisplayChannelIds.includes(channel.id)) {
                    currentDisplayChannelIds.push(channel.id);
                }
            } else {
                currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== channel.id);
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

    if (currentDisplayChannelIds.length === 0 && !allCb.checked) {
        currentDisplayChannelIds = [null];
        allCb.checked = true;
    }
    syncCheckboxes();
}

function updateShowChannelsCheckboxes() {
    // kept for compatibility (not used directly)
}

// ---------------------- Panel toggle logic ----------------------
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

// ---------------------- Filter buttons logic (with trash and term) ----------------------
function updateFilterButtonsUI() {
    if (activeWatchingFilter) filterWatchingBtn.classList.add('active');
    else filterWatchingBtn.classList.remove('active');
    if (activeFavoriteFilter) filterFavoriteBtn.classList.add('active');
    else filterFavoriteBtn.classList.remove('active');
    if (activeTrashFilter) filterTrashBtn.classList.add('active');
    else filterTrashBtn.classList.remove('active');
}

function toggleWatchingFilter() {
    if (activeTrashFilter) {
        activeTrashFilter = false;
        updateFilterButtonsUI();
    }
    activeWatchingFilter = !activeWatchingFilter;
    if (activeWatchingFilter) activeFavoriteFilter = false;
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleFavoriteFilter() {
    if (activeTrashFilter) {
        activeTrashFilter = false;
        updateFilterButtonsUI();
    }
    activeFavoriteFilter = !activeFavoriteFilter;
    if (activeFavoriteFilter) activeWatchingFilter = false;
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

function toggleTrashFilter() {
    activeTrashFilter = !activeTrashFilter;
    if (activeTrashFilter) {
        activeWatchingFilter = false;
        activeFavoriteFilter = false;
        activeTermFilter = null;          // clear term filter when entering trash
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

if (filterWatchingBtn) filterWatchingBtn.addEventListener('click', toggleWatchingFilter);
if (filterFavoriteBtn) filterFavoriteBtn.addEventListener('click', toggleFavoriteFilter);
if (filterTrashBtn) filterTrashBtn.addEventListener('click', toggleTrashFilter);

// ---------------------- Terms bar management ----------------------
// Collect all unique search terms from all movies (main store only)
async function refreshAvailableTerms() {
    const allMovies = await getAllMovies();
    const termsSet = new Set();
    for (const movie of allMovies) {
        (movie.searchTerms || []).forEach(term => termsSet.add(term));
    }
    availableTerms = Array.from(termsSet).sort(); // alphabetical order
    renderTermsBar();
}

function renderTermsBar() {
    if (activeTrashFilter) {
        termsBar.innerHTML = ''; // hide terms bar in trash view
        return;
    }
    if (availableTerms.length === 0) {
        termsBar.innerHTML = '<div class="terms-placeholder">No search terms yet</div>';
        return;
    }
    // Use unified button classes: btn, btn-secondary, btn-sm, and btn-active when active
    const html = availableTerms.map(term => `
        <button class="btn btn-secondary btn-sm ${activeTermFilter === term ? 'btn-active' : ''}" data-term="${escapeHtml(term)}">
            ${escapeHtml(term)}
            <span class="term-delete" data-term="${escapeHtml(term)}" title="Delete this term from all movies">✖</span>
        </button>
    `).join('');
    termsBar.innerHTML = html;

    // Attach click handlers to term buttons (filter) - select .btn within termsBar
    document.querySelectorAll('#termsBar .btn').forEach(btn => {
        const term = btn.dataset.term;
        btn.addEventListener('click', (e) => {
            // Prevent delete click from triggering filter
            if (e.target.classList.contains('term-delete')) return;
            // Toggle term filter
            if (activeTermFilter === term) {
                activeTermFilter = null;
            } else {
                activeTermFilter = term;
            }
            loadAndDisplayAll();
            renderTermsBar(); // re-render to show active class
        });
    });

    // Attach delete handlers (keep as before)
    document.querySelectorAll('.term-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const term = deleteSpan.dataset.term;
            if (confirm(`Delete term "${term}" from all movies? This action cannot be undone.`)) {
                await removeTermFromAllMovies(term);
                if (activeTermFilter === term) {
                    activeTermFilter = null;
                }
                await refreshAvailableTerms();
                loadAndDisplayAll();
            }
        });
    });
}

// Remove a term from every movie's searchTerms array
async function removeTermFromAllMovies(term) {
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    const allMovies = await getAllMovies(); // already uses openDB
    for (const movie of allMovies) {
        if (movie.searchTerms && movie.searchTerms.includes(term)) {
            const newTerms = movie.searchTerms.filter(t => t !== term);
            movie.searchTerms = newTerms;
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

// ---------------------- Load and display movies (with term filter) ----------------------
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies;

    if (activeTrashFilter) {
        const channelIds = (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) ? currentDisplayChannelIds : null;
        allMovies = await getTrashMovies(channelIds);
    } else {
        allMovies = await getAllMovies();
        if (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) {
            allMovies = allMovies.filter(movie => currentDisplayChannelIds.includes(movie.channelId));
        }
        if (activeTermFilter) {
            allMovies = allMovies.filter(movie => (movie.searchTerms || []).includes(activeTermFilter));
        }
        if (activeWatchingFilter) allMovies = allMovies.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) allMovies = allMovies.filter(movie => movie.favorite === true);
    }

    // Define callback for sort change
    const onSortChange = (newSort) => {
        currentSort = newSort;
        loadAndDisplayAll(); // re-render with new sort
    };

    renderMovies(resultsGrid, allMovies, activeTrashFilter ? `Trash (${allMovies.length})` : `Movies (${allMovies.length})`, activeTrashFilter ? 'trash' : 'main', currentSort, onSortChange);
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
        // Refresh global terms list after updating a movie's terms
        await refreshAvailableTerms();
        // If current active term filter was removed from this movie, reload display
        if (activeTermFilter && !movie.searchTerms.includes(activeTermFilter)) {
            loadAndDisplayAll();
        }
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
        await refreshAvailableTerms();  // update terms list after saving
        await loadAndDisplayAll();
        searchInput.value = '';
    } catch (err) {
        console.error(err);
        resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
    }
};

// ---------------------- Initialization ----------------------
async function init() {
    await dbReady;
    buildSearchInPanel();
    buildShowChannelsPanel();
    initModal(() => {
        refreshAvailableTerms();
        loadAndDisplayAll();
    });
    await refreshAvailableTerms();
    loadAndDisplayAll();
}
init();

// Listen for watching toggles from cards to refresh filter view
window.addEventListener('watching-toggled', () => {
    if (activeWatchingFilter && !activeTrashFilter) {
        loadAndDisplayAll();
    }
});

// Helper to escape HTML in strings (used in renderTermsBar)
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}