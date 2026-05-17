// js/app.js - Plato App (with fixed modal term management, removed channel filter)
// ==========================================

import { openDB, getAllMovies, getTrashMovies, saveMovie, toggleWatching, moveMovieToTrash, restoreMovieFromTrash, permanentlyDeleteMovie, renameTermInAllMovies } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';
import { SEARCH_OPTIONS } from './channels.js';
import { initModal, openModal } from './modal.js';

// ---------------------- DOM elements ----------------------
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const searchInBtn = document.getElementById('searchInBtn');
const searchInPanel = document.getElementById('searchInPanel');
const filterWatchingBtn = document.getElementById('filterWatchingBtn');
const filterFavoriteBtn = document.getElementById('filterFavoriteBtn');
const filterTrashBtn = document.getElementById('filterTrashBtn');
const termsBar = document.getElementById('termsBar');
const settingsBtn = document.getElementById('settingsBtn');
const settingsSidebar = document.getElementById('settingsSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const termsManagementList = document.getElementById('termsManagementList');

// ---------------------- Global state ----------------------
let dbReady = openDB();
let currentSearchOptionId = "UCuVPpxrm2VAgpH3Ktln4HXg"; // default: YouTube Free Movies

let activeWatchingFilter = false;
let activeFavoriteFilter = false;
let activeTrashFilter = false;
let activeTermFilter = null;
let availableTerms = [];
let currentSort = 'date';

// ---------------------- Helper: close panels ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => panel.classList.add('hidden'), 150);
}

// ---------------------- Build Search In panel (exclusive: API or local) ----------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.textContent = 'Search in';
    searchInPanel.appendChild(header);

    function setExclusive(clickedOptionId) {
        currentSearchOptionId = clickedOptionId;
        updateSearchInButtonText();
        closePanelWithDelay(searchInPanel);
        // No need to reload results automatically; only when search button is pressed
    }

    function updateSearchInButtonText() {
        const option = SEARCH_OPTIONS.find(opt => opt.id === currentSearchOptionId);
        const label = option ? option.name : 'Select';
        searchInBtn.innerHTML = `
            <span class="material-symbols-outlined">subscriptions</span>
            ${label}
            <span class="material-symbols-outlined">arrow_drop_down</span>
        `;
    }

    SEARCH_OPTIONS.forEach(option => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'searchIn';
        radio.value = option.id;
        radio.checked = (currentSearchOptionId === option.id);
        radio.addEventListener('change', () => {
            if (radio.checked) {
                setExclusive(option.id);
            }
        });
        label.appendChild(radio);
        label.appendChild(document.createTextNode(option.name));
        searchInPanel.appendChild(label);
    });

    updateSearchInButtonText();
}

// ---------------------- Sidebar functions (unchanged) ----------------------
function openSettingsSidebar() {
    settingsSidebar.classList.remove('hidden');
    sidebarOverlay.classList.remove('hidden');
    renderTermsManagement();
}
function closeSettingsSidebar() {
    settingsSidebar.classList.add('hidden');
    sidebarOverlay.classList.add('hidden');
}
settingsBtn.addEventListener('click', openSettingsSidebar);
closeSidebarBtn.addEventListener('click', closeSettingsSidebar);
sidebarOverlay.addEventListener('click', closeSettingsSidebar);

async function renderTermsManagement() {
    if (!termsManagementList) return;
    const terms = [...availableTerms];
    if (terms.length === 0) {
        termsManagementList.innerHTML = '<div class="terms-placeholder">No terms available</div>';
        return;
    }
    termsManagementList.innerHTML = '';
    for (const term of terms) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'term-management-item';
        itemDiv.dataset.term = term;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'term-management-name';
        nameSpan.textContent = term;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'term-management-actions';

        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
        editBtn.title = 'Edit term';
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
        deleteBtn.title = 'Delete term from all movies';

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(actionsDiv);
        termsManagementList.appendChild(itemDiv);

        editBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = term;
            input.className = 'edit-term-input';
            itemDiv.replaceChild(input, nameSpan);

            const saveBtn = document.createElement('button');
            saveBtn.innerHTML = '<span class="material-symbols-outlined">check</span>';
            saveBtn.title = 'Save changes';
            const cancelBtn = document.createElement('button');
            cancelBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
            cancelBtn.title = 'Cancel';
            actionsDiv.replaceChild(saveBtn, editBtn);
            actionsDiv.insertBefore(cancelBtn, saveBtn.nextSibling);

            const saveChanges = async () => {
                const newTerm = input.value.trim();
                if (!newTerm || newTerm === term) {
                    cancelEdit();
                    return;
                }
                try {
                    await renameTermInAllMovies(term, newTerm);
                    await refreshAvailableTerms();
                    if (activeTermFilter === term) activeTermFilter = newTerm;
                    await loadAndDisplayAll();
                    renderTermsManagement();
                    renderTermsBar();
                } catch (err) {
                    console.error('Error renaming term:', err);
                    alert('Failed to rename term.');
                    cancelEdit();
                }
            };
            const cancelEdit = () => {
                itemDiv.replaceChild(nameSpan, input);
                actionsDiv.replaceChild(editBtn, saveBtn);
                actionsDiv.removeChild(cancelBtn);
            };
            saveBtn.onclick = saveChanges;
            cancelBtn.onclick = cancelEdit;
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveChanges();
            });
            input.focus();
        };

        deleteBtn.onclick = async () => {
            if (confirm(`Delete term "${term}" from all movies? This cannot be undone.`)) {
                try {
                    await removeTermFromAllMovies(term);
                    if (activeTermFilter === term) activeTermFilter = null;
                    await refreshAvailableTerms();
                    await loadAndDisplayAll();
                    renderTermsManagement();
                    renderTermsBar();
                } catch (err) {
                    console.error('Error deleting term:', err);
                    alert('Failed to delete term.');
                }
            }
        };
    }
}

// ---------------------- Panel toggle logic (only searchIn) ----------------------
searchInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchInPanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!searchInBtn.contains(e.target) && !searchInPanel.contains(e.target)) searchInPanel.classList.add('hidden');
});

// ---------------------- Filter buttons logic (unchanged) ----------------------
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
        activeTermFilter = null;
    }
    updateFilterButtonsUI();
    loadAndDisplayAll();
}

if (filterWatchingBtn) filterWatchingBtn.addEventListener('click', toggleWatchingFilter);
if (filterFavoriteBtn) filterFavoriteBtn.addEventListener('click', toggleFavoriteFilter);
if (filterTrashBtn) filterTrashBtn.addEventListener('click', toggleTrashFilter);

// ---------------------- Terms bar management (unchanged) ----------------------
async function refreshAvailableTerms() {
    const allMovies = await getAllMovies();
    const termsSet = new Set();
    for (const movie of allMovies) {
        (movie.searchTerms || []).forEach(term => termsSet.add(term));
    }
    availableTerms = Array.from(termsSet).sort();
    renderTermsBar();
}

function renderTermsBar() {
    if (activeTrashFilter) {
        termsBar.innerHTML = '';
        return;
    }
    if (availableTerms.length === 0) {
        termsBar.innerHTML = '<div class="terms-placeholder">No search terms yet</div>';
        return;
    }
    const html = availableTerms.map(term => `
        <button class="btn btn-secondary btn-sm ${activeTermFilter === term ? 'active' : ''}" data-term="${escapeHtml(term)}">
            ${escapeHtml(term)}
            <span class="term-delete" data-term="${escapeHtml(term)}" title="Delete this term from all movies">✖</span>
        </button>
    `).join('');
    termsBar.innerHTML = html;

    document.querySelectorAll('#termsBar .btn').forEach(btn => {
        const term = btn.dataset.term;
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('term-delete')) return;
            if (activeTermFilter === term) activeTermFilter = null;
            else activeTermFilter = term;
            loadAndDisplayAll();
            renderTermsBar();
        });
    });

    document.querySelectorAll('.term-delete').forEach(deleteSpan => {
        deleteSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            const term = deleteSpan.dataset.term;
            if (confirm(`Delete term "${term}" from all movies?`)) {
                try {
                    await removeTermFromAllMovies(term);
                    if (activeTermFilter === term) activeTermFilter = null;
                    await refreshAvailableTerms();
                    loadAndDisplayAll();
                    if (settingsSidebar && !settingsSidebar.classList.contains('hidden')) {
                        renderTermsManagement();
                    }
                } catch (err) {
                    console.error(err);
                    alert('Failed to delete term.');
                }
            }
        });
    });
}

async function removeTermFromAllMovies(term) {
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction(['movies'], 'readwrite');
    const store = transaction.objectStore('movies');
    for (const movie of allMovies) {
        if (movie.searchTerms && movie.searchTerms.includes(term)) {
            movie.searchTerms = movie.searchTerms.filter(t => t !== term);
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}

// ---------------------- Load and display movies (no channel filter) ----------------------
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies;

    if (activeTrashFilter) {
        allMovies = await getTrashMovies(); // no channelIds parameter
    } else {
        allMovies = await getAllMovies();
        if (activeTermFilter) {
            allMovies = allMovies.filter(movie => (movie.searchTerms || []).includes(activeTermFilter));
        }
        if (activeWatchingFilter) allMovies = allMovies.filter(movie => movie.watching === true);
        if (activeFavoriteFilter) allMovies = allMovies.filter(movie => movie.favorite === true);
    }

    const onSortChange = (newSort) => {
        currentSort = newSort;
        loadAndDisplayAll();
    };

    renderMovies(resultsGrid, allMovies, activeTrashFilter ? `Trash (${allMovies.length})` : `Movies (${allMovies.length})`, activeTrashFilter ? 'trash' : 'main', currentSort, onSortChange);
}

// ---------------------- Modal-related functions (unchanged) ----------------------
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
        await refreshAvailableTerms();
        if (activeTermFilter && !movie.searchTerms.includes(activeTermFilter)) {
            loadAndDisplayAll();
        }
        if (settingsSidebar && !settingsSidebar.classList.contains('hidden')) {
            renderTermsManagement();
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
        return movie.favorite; // esto es crucial
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

// ---------------------- Search: API or local DB ----------------------
searchBtn.onclick = async () => {
    // Reset filters to show search results (but keep trash filter? Usually search should exit trash mode)
    if (activeTrashFilter) {
        activeTrashFilter = false;
        updateFilterButtonsUI();
    }
    // We do not reset watching/favorite filters automatically; user may want to combine? But typical search should show all results.
    // However to be consistent with old behavior, let's keep activeWatchingFilter and activeFavoriteFilter as they are.
    // But search results should override term filter? We'll clear term filter for new search.
    activeTermFilter = null;
    
    const query = searchInput.value.trim();
    if (!query) {
        resultsGrid.innerHTML = '<div class="stats">Enter a search term</div>';
        return;
    }
    
    const selectedOption = SEARCH_OPTIONS.find(opt => opt.id === currentSearchOptionId);
    if (!selectedOption) return;
    
    if (selectedOption.type === 'api') {
        // Search via YouTube API
        resultsGrid.innerHTML = '<div class="stats">Searching YouTube...</div>';
        try {
            const channelId = selectedOption.id === 'plato_db' ? null : selectedOption.id;
            const moviesFromAPI = await searchYouTube(query, channelId);
            if (moviesFromAPI.length === 0) {
                resultsGrid.innerHTML = '<div class="stats">No movies found on YouTube</div>';
                return;
            }
            for (const movie of moviesFromAPI) {
                await saveMovie(movie, query);
            }
            await refreshAvailableTerms();
            await loadAndDisplayAll();
            searchInput.value = '';
        } catch (err) {
            console.error(err);
            resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
        }
    } else { // type === 'local' -> Plato DB
        resultsGrid.innerHTML = '<div class="stats">Searching in Plato DB...</div>';
        const allMovies = await getAllMovies();
        const lowerQuery = query.toLowerCase();
        const filtered = allMovies.filter(movie => {
            const titleMatch = movie.title.toLowerCase().includes(lowerQuery);
            const descMatch = movie.description && movie.description.toLowerCase().includes(lowerQuery);
            const termsMatch = (movie.searchTerms || []).some(term => term.toLowerCase().includes(lowerQuery));
            return titleMatch || descMatch || termsMatch;
        });
        if (filtered.length === 0) {
            resultsGrid.innerHTML = '<div class="stats">No matching movies found in Plato DB</div>';
        } else {
            // Show results directly without saving (they are already in DB)
            const onSortChange = (newSort) => {
                currentSort = newSort;
                // re-render with same filtered list
                renderMovies(resultsGrid, filtered, `Search results for "${query}" (${filtered.length})`, 'main', currentSort, onSortChange);
            };
            renderMovies(resultsGrid, filtered, `Search results for "${query}" (${filtered.length})`, 'main', currentSort, onSortChange);
        }
        searchInput.value = '';
    }
};

// ---------------------- Initialization ----------------------
async function init() {
    await dbReady;
    buildSearchInPanel();
    initModal(() => {
        refreshAvailableTerms();
        loadAndDisplayAll();
    });
    await refreshAvailableTerms();
    loadAndDisplayAll();
}
init();

window.addEventListener('watching-toggled', () => {
    if (activeWatchingFilter && !activeTrashFilter) {
        loadAndDisplayAll();
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}