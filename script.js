// script.js - Modos independientes: cada modo tiene sus propios tags generados desde su bolsa
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL_ID = 'UCuVPpxrm2VAgpH3Ktln4HXg';
const SEARCH_MODE = 'channel'; // 'keywords' (original) o 'channel' (búsqueda exclusiva en el canal)
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RESULTS_PER_TERM = 500;
const FILTERED_SEARCH_KEY = 'plato_filtered_searches';
const EXCLUDED_SEARCH_KEY = 'plato_excluded_searches';

const SHOW_EXTRA_FILTERED = 'show_extra_info_filtered';
const SHOW_EXTRA_EXCLUDED = 'show_extra_info_excluded';

const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const resultsTitle = document.getElementById('resultsTitle');
const resultsStats = document.getElementById('resultsStats');
const loadingDiv = document.getElementById('loading');
const fullSearchDiv = document.getElementById('fullSearch');
const clearStorageBtn = document.getElementById('clearStorageBtn');
const settingsBtn = document.getElementById('settingsBtn');
const modeToggle = document.getElementById('modeToggle');
const modal = document.getElementById('movieModal');
const closeModal = document.querySelector('.close-modal');
const modalBody = document.getElementById('modalBody');
const watchBtn = document.getElementById('watchMovieBtn');
let currentMovieUrl = '';

let nextPageToken = null;
let currentQuery = '';
let allResults = [];
let currentSearchTerm = '';
let currentViewMode = 'filtered';
let currentSort = 'date';
let currentTermForView = null;

let previousViewState = null;
let isSettingsView = false;

// ========== Funciones auxiliares (sin cambios) ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function getLocalDateKey(d) {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function sortMovies(movies, primarySort) {
    const sorted = [...movies];
    if (primarySort === 'title') {
        sorted.sort((a,b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    } else if (primarySort === 'channel') {
        sorted.sort((a,b) => {
            const channelCompare = a.channel.localeCompare(b.channel, undefined, { sensitivity: 'base' });
            if (channelCompare !== 0) return channelCompare;
            return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        });
    } else {
        sorted.sort((a,b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        });
    }
    return sorted;
}

function renderMovies(movies, sortBy, titlePrefix) {
    const sorted = sortMovies(movies, sortBy);
    const isDateSort = (sortBy === 'date');
    if (sorted.length === 0) {
        resultsGrid.innerHTML = '<p class="stats">No movies to display.</p>';
        resultsStats.innerHTML = '';
        resultsTitle.innerText = titlePrefix;
        return;
    }
    if (isDateSort) {
        const groups = new Map();
        const todayKey = getLocalDateKey(new Date());
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = getLocalDateKey(yesterdayDate);
        sorted.forEach(movie => {
            const localKey = getLocalDateKey(movie.date);
            if (!groups.has(localKey)) groups.set(localKey, []);
            groups.get(localKey).push(movie);
        });
        const sortedGroups = Array.from(groups.entries()).sort((a,b) => new Date(b[0]) - new Date(a[0]));
        let html = '';
        for (const [dateKey, movieList] of sortedGroups) {
            let label;
            if (dateKey === todayKey) label = 'Today';
            else if (dateKey === yesterdayKey) label = 'Yesterday';
            else {
                const [year, month, day] = dateKey.split('-');
                const dateObj = new Date(year, month-1, day);
                label = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            html += `<div class="date-group"><div class="group-date">${label}</div><div class="results-group">`;
            html += movieList.map(movie => `
                <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
                    <img src="${movie.imageUrl}" alt="${movie.title}">
                    <div class="info">
                        <h3>${escapeHtml(movie.title)}</h3>
                        <div class="channel">${escapeHtml(movie.channel)}</div>
                    </div>
                </div>
            `).join('');
            html += `</div></div>`;
        }
        resultsGrid.innerHTML = html;
        resultsGrid.style.display = 'block';
    } else {
        resultsGrid.innerHTML = sorted.map(movie => `
            <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
                <img src="${movie.imageUrl}" alt="${movie.title}">
                <div class="info">
                    <h3>${escapeHtml(movie.title)}</h3>
                    <div class="channel">${escapeHtml(movie.channel)}</div>
                </div>
            </div>
        `).join('');
        resultsGrid.style.display = 'grid';
    }
    resultsTitle.innerText = titlePrefix;
    const sortLabel = sortBy === 'date' ? 'by date' : (sortBy === 'title' ? 'by title' : 'by channel');
    resultsStats.innerHTML = `<strong>${sorted.length} movies</strong> · <span id="sortButtons">Sort by: <button data-sort="date">Date</button> | <button data-sort="title">Title</button> | <button data-sort="channel">Channel</button></span>`;
    const buttons = resultsStats.querySelectorAll('#sortButtons button');
    buttons.forEach(btn => {
        btn.onclick = () => {
            currentSort = btn.dataset.sort;
            if (!isSettingsView) updateView();
        };
    });
}

function updateView() {
    if (isSettingsView) return;
    const storageKey = (currentViewMode === 'filtered') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    const searches = JSON.parse(localStorage.getItem(storageKey) || '[]');
    let movies = [];
    if (currentTermForView) {
        const termData = searches.find(entry => entry.searchTerm === currentTermForView);
        movies = termData ? termData.results : [];
    } else {
        const all = [];
        searches.forEach(entry => all.push(...entry.results));
        const unique = [];
        const ids = new Set();
        all.forEach(m => {
            if (!ids.has(m.id)) {
                ids.add(m.id);
                unique.push(m);
            }
        });
        movies = unique;
    }
    const titleMap = {
        filtered: currentTermForView ? `Free Movies: "${currentTermForView}"` : 'All Saved Free Movies',
        excluded: currentTermForView ? `Excluded (Non‑Free) results for "${currentTermForView}"` : 'All Excluded Results'
    };
    const sortLabel = currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel');
    const titlePrefix = `${titleMap[currentViewMode]} (${sortLabel})`;
    renderMovies(movies, currentSort, titlePrefix);
}

function updateSettingsIcon() {
    if (currentViewMode === 'filtered') {
        settingsBtn.innerHTML = 'settings_heart';
        settingsBtn.title = 'Settings for Free Movies';
    } else {
        settingsBtn.innerHTML = 'video_settings';
        settingsBtn.title = 'Settings for Excluded Results';
    }
}

function showSettings() {
    previousViewState = {
        viewMode: currentViewMode,
        termForView: currentTermForView,
        sort: currentSort
    };
    isSettingsView = true;
    resultsTitle.innerText = 'Settings';
    const currentPrefKey = (currentViewMode === 'filtered') ? SHOW_EXTRA_FILTERED : SHOW_EXTRA_EXCLUDED;
    const currentPrefValue = localStorage.getItem(currentPrefKey) === 'true';
    resultsGrid.innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
            <h3 style="margin-bottom: 20px;">Display options for ${currentViewMode === 'filtered' ? 'Free Movies' : 'Excluded Results'}</h3>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input type="checkbox" id="showExtraInfoCheckbox" ${currentPrefValue ? 'checked' : ''}>
                <span>Show technical information in movie modal (ID, dates, etc.)</span>
            </label>
            <div style="margin-top: 30px;">
                <button id="backFromSettingsBtn" class="secondary-btn" style="background: #2a2a2a; padding: 8px 20px; border-radius: 20px;">← Back</button>
            </div>
        </div>
    `;
    resultsStats.innerHTML = '';
    const checkbox = document.getElementById('showExtraInfoCheckbox');
    if (checkbox) {
        checkbox.onchange = () => {
            localStorage.setItem(currentPrefKey, checkbox.checked);
        };
    }
    const backBtn = document.getElementById('backFromSettingsBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            isSettingsView = false;
            if (previousViewState) {
                currentViewMode = previousViewState.viewMode;
                currentTermForView = previousViewState.termForView;
                currentSort = previousViewState.sort;
                previousViewState = null;
            }
            updateView();
            refreshTopBar();
            configureTrashButton();
            updateSettingsIcon();
            if (currentViewMode === 'excluded') {
                modeToggle.classList.add('excluded-mode');
                document.body.classList.add('excluded-mode');
            } else {
                modeToggle.classList.remove('excluded-mode');
                document.body.classList.remove('excluded-mode');
            }
        };
    }
}

function saveSearchResults(searchTerm, rawItems) {
    const filteredItems = [];
    const excludedItems = [];
    rawItems.forEach(item => {
        const movie = {
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            imageUrl: item.snippet.thumbnails.medium.url,
            url: `https://youtube.com/watch?v=${item.id.videoId}`,
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            searchTerm: searchTerm,
            date: new Date().toISOString()
        };
        if (item.snippet.channelId === TARGET_CHANNEL_ID) {
            filteredItems.push(movie);
        } else {
            excludedItems.push(movie);
        }
    });

    function updateBucket(storageKey, newItems) {
        let searches = JSON.parse(localStorage.getItem(storageKey) || '[]');
        let idx = searches.findIndex(entry => entry.searchTerm === searchTerm);
        let existing = idx !== -1 ? searches[idx].results : [];
        const existingIds = new Set(existing.map(m => m.id));
        const toAdd = newItems.filter(m => !existingIds.has(m.id));
        const combined = [...existing, ...toAdd];
        combined.sort((a,b) => new Date(b.date) - new Date(a.date));
        const limited = combined.slice(0, MAX_RESULTS_PER_TERM);
        const entry = { searchTerm, date: new Date().toISOString(), results: limited };
        if (idx !== -1) searches[idx] = entry;
        else searches.unshift(entry);
        searches = searches.slice(0, 20);
        localStorage.setItem(storageKey, JSON.stringify(searches));
    }

    updateBucket(FILTERED_SEARCH_KEY, filteredItems);
    updateBucket(EXCLUDED_SEARCH_KEY, excludedItems);
}

// Genera los tags a partir del bucket del modo actual (sin STORAGE_KEY)
function refreshTopBar() {
    const currentBucket = (currentViewMode === 'filtered') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    const searches = JSON.parse(localStorage.getItem(currentBucket) || '[]');
    const terms = searches.map(entry => entry.searchTerm).filter((v,i,a)=>a.indexOf(v)===i);
    const filterIcon = (currentViewMode === 'filtered') ? 'filter_alt' : 'video_search';
    const filterTitle = (currentViewMode === 'filtered') ? 'Show all Free Movies' : 'Show all Excluded Results';
    let html = `<button class="full-search-btn material-symbols-outlined" id="unionIcon" title="${filterTitle}">${filterIcon}</button>`;
    if (terms.length === 0) {
        html += '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">No recent searches in this mode.</div>';
        fullSearchDiv.innerHTML = html;
    } else {
        html += terms.map(term => `
            <button class="full-search-btn tag-btn" data-term="${term}">
                ${term}
                <span class="history-delete" data-term="${term}">✖</span>
            </button>
        `).join('');
        fullSearchDiv.innerHTML = html;
    }

    const unionIcon = document.getElementById('unionIcon');
    if (unionIcon) {
        unionIcon.onclick = () => {
            if (isSettingsView) return;
            currentTermForView = null;
            currentSort = 'date';
            updateView();
        };
    }
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.onclick = () => {
            if (isSettingsView) return;
            currentTermForView = btn.dataset.term;
            currentSort = 'date';
            updateView();
        };
    });

    document.querySelectorAll('.history-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const term = btn.dataset.term;
            const bucketToUpdate = (currentViewMode === 'filtered') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
            let searches = JSON.parse(localStorage.getItem(bucketToUpdate) || '[]');
            searches = searches.filter(entry => entry.searchTerm !== term);
            localStorage.setItem(bucketToUpdate, JSON.stringify(searches));
            if (currentTermForView === term) {
                currentTermForView = null;
                currentSort = 'date';
                updateView();
            } else {
                updateView();
            }
            refreshTopBar();
        };
    });
}

function configureTrashButton() {
    if (currentViewMode === 'filtered') {
        clearStorageBtn.onclick = () => {
            if (confirm('Delete ALL Free Movies data? (This will erase all filtered results from "YouTube Movies" channel)')) {
                localStorage.removeItem(FILTERED_SEARCH_KEY);
                refreshTopBar();
                if (currentViewMode === 'filtered') {
                    currentTermForView = null;
                    currentSort = 'date';
                    updateView();
                }
                alert('All Free Movies data cleared.');
            }
        };
        clearStorageBtn.title = 'Delete all Free Movies data';
    } else {
        clearStorageBtn.onclick = () => {
            if (confirm('Delete ALL Excluded data? (This will erase all results that are not from "YouTube Movies" channel)')) {
                localStorage.removeItem(EXCLUDED_SEARCH_KEY);
                refreshTopBar();
                if (currentViewMode === 'excluded') {
                    currentTermForView = null;
                    currentSort = 'date';
                    updateView();
                }
                alert('All Excluded data cleared.');
            }
        };
        clearStorageBtn.title = 'Delete all Excluded results';
    }
}

settingsBtn.onclick = () => {
    if (!isSettingsView) {
        showSettings();
    } else {
        const backBtn = document.getElementById('backFromSettingsBtn');
        if (backBtn) backBtn.click();
    }
};

// ========== FUNCIÓN DE BÚSQUEDA MODIFICADA (con constante SEARCH_MODE) ==========
async function performSearch(query) {
    loadingDiv.style.display = 'flex';
    try {
        let url;
        if (SEARCH_MODE === 'channel') {
            // Búsqueda exclusiva en el canal TARGET_CHANNEL_ID
            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&channelId=${TARGET_CHANNEL_ID}&q=${encodeURIComponent(query)}&maxResults=${MAX_RESULTS_PER_PAGE}&key=${API_KEY}`;
        } else {
            // Modo original: palabras clave adicionales
            const keywords = query + ' Películas Gratis YouTube Películas y TV de YouTube';
            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(keywords)}&key=${API_KEY}`;
        }
        const response = await fetch(url);
        const data = await response.json();
        if (data.items) {
            saveSearchResults(currentSearchTerm, data.items);
            currentViewMode = 'filtered';
            currentTermForView = currentSearchTerm;
            currentSort = 'date';
            if (!isSettingsView) updateView();
            refreshTopBar();
            if (modeToggle.classList.contains('excluded-mode')) modeToggle.classList.remove('excluded-mode');
            if (document.body.classList.contains('excluded-mode')) document.body.classList.remove('excluded-mode');
            currentViewMode = 'filtered';
            configureTrashButton();
            updateSettingsIcon();
            if (isSettingsView) {
                const backBtn = document.getElementById('backFromSettingsBtn');
                if (backBtn) backBtn.click();
            }
        }
    } catch (error) {
        resultsGrid.innerHTML = `<p class="stats">Error: ${error.message}</p>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// El resto del código (searchBtn.onclick, toggleMode, init, openModal) se mantiene igual
searchBtn.onclick = async () => {
    const baseQuery = searchInput.value.trim();
    if (!baseQuery) return;
    currentSearchTerm = baseQuery;
    searchInput.value = '';
    await performSearch(currentSearchTerm);
};

function toggleMode() {
    if (isSettingsView) return;
    currentViewMode = (currentViewMode === 'filtered') ? 'excluded' : 'filtered';
    currentTermForView = null;
    currentSort = 'date';
    updateView();
    if (currentViewMode === 'excluded') {
        modeToggle.classList.add('excluded-mode');
        document.body.classList.add('excluded-mode');
    } else {
        modeToggle.classList.remove('excluded-mode');
        document.body.classList.remove('excluded-mode');
    }
    refreshTopBar();
    configureTrashButton();
    updateSettingsIcon();
}
modeToggle.onclick = toggleMode;

function init() {
    refreshTopBar();
    configureTrashButton();
    currentViewMode = 'filtered';
    currentTermForView = null;
    currentSort = 'date';
    isSettingsView = false;
    updateView();
    updateSettingsIcon();
}
init();

// ========== FUNCIÓN openModal MODIFICADA (elimina duplicados del bloque extra) ==========
function openModal(movie) {
    if (!modal) return;
    modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="delete-movie-btn material-symbols-outlined" style="cursor:pointer;">delete_forever</span>
            <h2 style="margin: 0; text-align: center;">${escapeHtml(movie.title)}</h2>
            <div style="width: 20px;"></div>
        </div>
        <img src="${movie.imageUrl}" style="width:100%; border-radius:8px; margin:10px 0;">
        <p><strong>YouTube Premiere:</strong> ${movie.publishedAt ? new Date(movie.publishedAt).toLocaleDateString() : 'Unknown'}</p>
        <div style="white-space: normal; word-wrap: break-word;">${escapeHtml(movie.description || 'No Description')}</div>
        <p><strong>Search performed:</strong> ${new Date(movie.date).toLocaleString()}</p>
        <p><strong>Key Word:</strong> ${escapeHtml(movie.searchTerm)}</p>
    `;
    const prefKey = (currentViewMode === 'filtered') ? SHOW_EXTRA_FILTERED : SHOW_EXTRA_EXCLUDED;
    const showExtra = localStorage.getItem(prefKey) === 'true';
    if (showExtra) {
        const extraDiv = document.createElement('div');
        extraDiv.style.cssText = 'margin-top: 12px; padding: 8px; background: #1e1e1e; border-radius: 8px; font-size: 12px; border-left: 3px solid #ff0000;';
        // Campos técnicos NO DUPLICADOS con la información básica:
        const fields = [
            { label: 'ID del video', value: movie.id },
            { label: 'Canal', value: movie.channel },
            { label: 'URL', value: movie.url },
            { label: 'URL de miniatura (medium)', value: movie.imageUrl },
        ];
        let html = '<ul style="margin: 0; padding-left: 16px;">';
        fields.forEach(f => {
            const displayValue = f.value ? escapeHtml(String(f.value)) : '<span style="color: #ff9999;">missing</span>';
            html += `<li><strong>${f.label}:</strong> ${displayValue}</li>`;
        });
        html += '</ul>';
        extraDiv.innerHTML = html;
        modalBody.appendChild(extraDiv);
    }
    currentMovieUrl = movie.url;
    modal.style.display = 'flex';
    const deleteBtn = modalBody.querySelector('.delete-movie-btn');
    if (deleteBtn) deleteBtn.onclick = () => {
        let filtered = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
        let excluded = JSON.parse(localStorage.getItem(EXCLUDED_SEARCH_KEY) || '[]');
        const removeFromArray = (arr, movieId) => arr.map(entry => ({ ...entry, results: entry.results.filter(m => m.id !== movieId) })).filter(entry => entry.results.length > 0);
        const newFiltered = removeFromArray(filtered, movie.id);
        const newExcluded = removeFromArray(excluded, movie.id);
        localStorage.setItem(FILTERED_SEARCH_KEY, JSON.stringify(newFiltered));
        localStorage.setItem(EXCLUDED_SEARCH_KEY, JSON.stringify(newExcluded));
        if (!isSettingsView) updateView();
        modal.style.display = 'none';
    };
}
if (closeModal) closeModal.onclick = () => { modal.style.display = 'none'; };
if (watchBtn) watchBtn.onclick = () => window.open(currentMovieUrl);
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };