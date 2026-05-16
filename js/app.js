// ==========================================
// js/app.js - Plato App (with fixed modal term management)
// ==========================================

import { openDB, getAllMovies, getTrashMovies, saveMovie, toggleWatching, moveMovieToTrash, restoreMovieFromTrash, permanentlyDeleteMovie, renameTermInAllMovies } from './db.js';
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
const settingsBtn = document.getElementById('settingsBtn');
const settingsSidebar = document.getElementById('settingsSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const termsManagementList = document.getElementById('termsManagementList');

// ---------------------- Global state ----------------------
let dbReady = openDB();
let currentSearchChannelId = 'UCuVPpxrm2VAgpH3Ktln4HXg';
let currentDisplayChannelIds = ['UCuVPpxrm2VAgpH3Ktln4HXg'];

let activeWatchingFilter = false;
let activeFavoriteFilter = false;
let activeTrashFilter = false;
let activeTermFilter = null;
let availableTerms = [];
let currentSort = 'date';

// ---------------------- Helper: close panels ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
    showChannelsPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => panel.classList.add('hidden'), 150);
}

// ---------------------- Build Search In panel ----------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.textContent = 'Search in';
    searchInPanel.appendChild(header);

    function setExclusive(clickedCheckbox) {
        const all = searchInPanel.querySelectorAll('input[type="checkbox"]');
        all.forEach(cb => cb.checked = (cb === clickedCheckbox));
        const checked = Array.from(all).find(cb => cb.checked);
        currentSearchChannelId = checked ? (checked.value === '' ? null : checked.value) : null;
        updateSearchInButtonText();
        closePanelWithDelay(searchInPanel);
    }

    function updateSearchInButtonText() {
        let label = '';
        if (currentSearchChannelId === null) {
            label = 'All Channels';
        } else {
            const channel = CHANNELS.find(ch => ch.id === currentSearchChannelId);
            label = channel ? channel.name : 'All Channels';
        }
        searchInBtn.innerHTML = `
            <span class="material-symbols-outlined">subscriptions</span>
            ${label}
            <span class="material-symbols-outlined">arrow_drop_down</span>
        `;
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
                updateSearchInButtonText();
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
                    updateSearchInButtonText();
                    closePanelWithDelay(searchInPanel);
                }
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(channel.name));
        searchInPanel.appendChild(label);
    });

    updateSearchInButtonText();
}

// ---------------------- Build Show Channels panel ----------------------
function buildShowChannelsPanel() {
    showChannelsPanel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'dropdown-header';
    header.textContent = 'Show channels';
    showChannelsPanel.appendChild(header);

    function updateShowChannelsButtonText() {
        let text = '';
        if (currentDisplayChannelIds.length === 0) {
            text = 'None';
        } else if (currentDisplayChannelIds.includes(null)) {
            text = 'All Channels';
        } else if (currentDisplayChannelIds.length === 1) {
            const channel = CHANNELS.find(ch => ch.id === currentDisplayChannelIds[0]);
            text = channel ? channel.name : 'Channel';
        } else {
            text = `${currentDisplayChannelIds.length} channels`;
        }
        showChannelsBtn.innerHTML = `
            <span class="material-symbols-outlined">live_tv</span>
            ${text}
            <span class="material-symbols-outlined">arrow_drop_down</span>
        `;
    }

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
            updateShowChannelsButtonText();
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
            updateShowChannelsButtonText();
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
                    updateShowChannelsButtonText();
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
            updateShowChannelsButtonText();
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
    updateShowChannelsButtonText();
}

// ---------------------- Sidebar functions ----------------------
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

// ---------------------- Filter buttons logic ----------------------
function updateFilterButtonsUI() {
    if (activeWatchingFilter) filterWatchingBtn.classList.add('active');
    else filterWatchingBtn.classList.remove('active');
    if (activeFavoriteFilter) filterFavoriteBtn.classList.add('active');
    else filterFavoriteBtn.classList.remove('active');
    if (activeTrashFilter) filterTrashBtn.classList.add('active');
    else filterTrashBtn.classList.remove('active');
}

function toggleWatchingFilter() {
    // Si estamos en papelera, salimos de ella (consistente con Search)
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

// ---------------------- Terms bar management ----------------------
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

// ---------------------- Load and display movies ----------------------
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

    const onSortChange = (newSort) => {
        currentSort = newSort;
        loadAndDisplayAll();
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
    // Salir de los filtros Watching y Favorites si están activos (consistente con Trash)
    if (activeWatchingFilter) {
        activeWatchingFilter = false;
    }
    if (activeFavoriteFilter) {
        activeFavoriteFilter = false;
    }
    // También salir de la papelera si está activa
    if (activeTrashFilter) {
        activeTrashFilter = false;
    }
    updateFilterButtonsUI();

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
        await refreshAvailableTerms();
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

window.addEventListener('watching-toggled', () => {
    if (activeWatchingFilter && !activeTrashFilter) {
        loadAndDisplayAll();
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}