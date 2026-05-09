// script.js - Sin búsqueda automática al cargar
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL_ID = 'UCuVPpxrm2VAgpH3Ktln4HXg';
const SEARCH_MODE = 'channel';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RESULTS_PER_TERM = 500;
const MAX_TRASH_PER_TERM = 200;
const FILTERED_SEARCH_KEY = 'plato_filtered_searches';
const EXCLUDED_SEARCH_KEY = 'plato_excluded_searches';
const FILTERED_TRASH_KEY = 'plato_filtered_trash';
const EXCLUDED_TRASH_KEY = 'plato_excluded_trash';

const SHOW_EXTRA_FILTERED = 'show_extra_info_filtered';
const SHOW_EXTRA_EXCLUDED = 'show_extra_info_excluded';
const SEARCH_ORDER_VIEW_COUNT = 'search_order_view_count';

const EXTRA_SEARCH_TERMS = ' Películas Gratis YouTube Películas y TV de YouTube Movies';

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

// ========== Funciones auxiliares ==========
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

function renderMovies(movies, sortBy, titlePrefix, viewMode) {
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
                <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")}, "${viewMode}")'>
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
            <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")}, "${viewMode}")'>
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
            updateView();
        };
    });
}

function updateView() {
    if (isSettingsView) return;
    let storageKey, titlePrefixBase;
    if (currentViewMode === 'filtered') {
        storageKey = FILTERED_SEARCH_KEY;
        titlePrefixBase = 'Saved Free Movies';
    } else if (currentViewMode === 'excluded') {
        storageKey = EXCLUDED_SEARCH_KEY;
        titlePrefixBase = 'All Excluded Results';
    } else if (currentViewMode === 'filtered_trash') {
        storageKey = FILTERED_TRASH_KEY;
        titlePrefixBase = 'Trash – Free Movies';
    } else if (currentViewMode === 'excluded_trash') {
        storageKey = EXCLUDED_TRASH_KEY;
        titlePrefixBase = 'Trash – Excluded Results';
    } else return;

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
    const sortLabel = currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel');
    const titlePrefix = currentTermForView ? `${titlePrefixBase}: "${currentTermForView}" (${sortLabel})` : `${titlePrefixBase} (${sortLabel})`;
    renderMovies(movies, currentSort, titlePrefix, currentViewMode);
}

function updateSettingsIcon() {
    if (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') {
        settingsBtn.textContent = 'settings_heart';
        settingsBtn.title = 'Settings for Free Movies';
    } else {
        settingsBtn.textContent = 'video_settings';
        settingsBtn.title = 'Settings for Excluded Results';
    }
}

function closeSettingsAndRestore() {
    if (!isSettingsView) return;
    isSettingsView = false;
    if (previousViewState) {
        currentViewMode = previousViewState.viewMode;
        currentTermForView = previousViewState.termForView;
        currentSort = previousViewState.sort;
        previousViewState = null;
    } else {
        if (currentViewMode === 'filtered_trash') currentViewMode = 'filtered';
        else if (currentViewMode === 'excluded_trash') currentViewMode = 'excluded';
        currentTermForView = null;
        currentSort = 'date';
    }
    updateView();
    refreshTopBar();
    configureTrashButton();
    updateSettingsIcon();
    if (currentViewMode === 'excluded' || currentViewMode === 'excluded_trash') {
        modeToggle.classList.add('excluded-mode');
        document.body.classList.add('excluded-mode');
    } else {
        modeToggle.classList.remove('excluded-mode');
        document.body.classList.remove('excluded-mode');
    }
}

function showSettings() {
    previousViewState = {
        viewMode: currentViewMode,
        termForView: currentTermForView,
        sort: currentSort
    };
    isSettingsView = true;
    const modeName = (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') ? 'Filtered Search (Free Movies)' : 'Excluded Search (Non‑Free)';
    resultsTitle.innerText = `Settings – ${modeName}`;
    const currentPrefKey = (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') ? SHOW_EXTRA_FILTERED : SHOW_EXTRA_EXCLUDED;
    const currentPrefValue = localStorage.getItem(currentPrefKey) === 'true';
    const searchOrderViewCount = localStorage.getItem(SEARCH_ORDER_VIEW_COUNT) === 'true';
    
    resultsGrid.innerHTML = `
        <div class="settings-section">
            <h3 class="settings-section-title">Display</h3>
            <div class="settings-option">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    <input type="checkbox" id="showExtraInfoCheckbox" ${currentPrefValue ? 'checked' : ''}>
                    <span>Show technical information in movie modal (ID, dates, etc.)</span>
                </label>
            </div>
        </div>
        <div class="settings-section">
            <h3 class="settings-section-title">Search</h3>
            <div class="settings-option">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    <input type="checkbox" id="searchOrderViewCountCheckbox" ${searchOrderViewCount ? 'checked' : ''}>
                    <span>Buscar las 50 películas más vistas (ordenar por número de vistas)</span>
                </label>
            </div>
        </div>
        <div class="settings-section">
            <h3 class="settings-section-title">Delete</h3>
            <div class="settings-option">
                <button id="goToTrashBtn" class="full-search-btn" style="background: #2a2a2a; padding: 6px 18px;">🗑️ Go to Trash</button>
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
    const searchOrderCheckbox = document.getElementById('searchOrderViewCountCheckbox');
    if (searchOrderCheckbox) {
        searchOrderCheckbox.onchange = () => {
            localStorage.setItem(SEARCH_ORDER_VIEW_COUNT, searchOrderCheckbox.checked);
        };
    }
    const goToTrashBtn = document.getElementById('goToTrashBtn');
    if (goToTrashBtn) {
        goToTrashBtn.onclick = () => {
            closeSettingsAndRestore();
            if (currentViewMode === 'filtered') currentViewMode = 'filtered_trash';
            else if (currentViewMode === 'excluded') currentViewMode = 'excluded_trash';
            currentTermForView = null;
            currentSort = 'date';
            updateView();
            refreshTopBar();
            configureTrashButton();
            updateSettingsIcon();
            if (currentViewMode === 'excluded' || currentViewMode === 'excluded_trash') {
                modeToggle.classList.add('excluded-mode');
                document.body.classList.add('excluded-mode');
            } else {
                modeToggle.classList.remove('excluded-mode');
                document.body.classList.remove('excluded-mode');
            }
        };
    }
}

function saveSearchResults(searchTerm, enrichedItems) {
    const filteredItems = [];
    const excludedItems = [];
    enrichedItems.forEach(item => {
        const movie = {
            id: item.id,
            title: item.title,
            channel: item.channel,
            imageUrl: item.imageUrl,
            url: item.url,
            description: item.description,
            publishedAt: item.publishedAt,
            searchTerm: searchTerm,
            date: new Date().toISOString(),
            duration: item.duration,
            viewCount: item.viewCount,
            likeCount: item.likeCount,
            commentCount: item.commentCount,
            tags: item.tags
        };
        if (item.channelId === TARGET_CHANNEL_ID) filteredItems.push(movie);
        else excludedItems.push(movie);
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

// ========== GESTIÓN DE PAPELERA ==========
function getTrashKey(mode) {
    return (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_TRASH_KEY : EXCLUDED_TRASH_KEY;
}

function moveMovieToTrash(movie, mode) {
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const term = movie.searchTerm;
    let termEntry = trash.find(entry => entry.searchTerm === term);
    if (!termEntry) {
        termEntry = { searchTerm: term, date: new Date().toISOString(), results: [] };
        trash.unshift(termEntry);
    }
    const movieWithDeleted = { ...movie, deletedAt: new Date().toISOString() };
    if (!termEntry.results.some(m => m.id === movie.id)) {
        termEntry.results.push(movieWithDeleted);
        termEntry.results.sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        termEntry.results = termEntry.results.slice(0, MAX_TRASH_PER_TERM);
        termEntry.date = new Date().toISOString();
        localStorage.setItem(trashKey, JSON.stringify(trash));
    }
    let mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    let termMain = main.find(entry => entry.searchTerm === term);
    if (termMain) {
        termMain.results = termMain.results.filter(m => m.id !== movie.id);
        if (termMain.results.length === 0) main = main.filter(entry => entry.searchTerm !== term);
        else termMain.date = new Date().toISOString();
        localStorage.setItem(mainKey, JSON.stringify(main));
    }
    if (currentViewMode === mode && (currentTermForView === term || currentTermForView === null)) updateView();
    refreshTopBar();
}

function moveTermToTrash(term, mode) {
    const mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    const termEntry = main.find(entry => entry.searchTerm === term);
    if (!termEntry) return;
    const moviesWithDeleted = termEntry.results.map(movie => ({ ...movie, deletedAt: new Date().toISOString() }));
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    let trashTermEntry = trash.find(entry => entry.searchTerm === term);
    if (trashTermEntry) {
        const existingIds = new Set(trashTermEntry.results.map(m => m.id));
        const newMovies = moviesWithDeleted.filter(m => !existingIds.has(m.id));
        trashTermEntry.results.push(...newMovies);
        trashTermEntry.results.sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        trashTermEntry.results = trashTermEntry.results.slice(0, MAX_TRASH_PER_TERM);
        trashTermEntry.date = new Date().toISOString();
    } else {
        trash.unshift({ searchTerm: term, date: new Date().toISOString(), results: moviesWithDeleted.slice(0, MAX_TRASH_PER_TERM) });
    }
    localStorage.setItem(trashKey, JSON.stringify(trash));
    main = main.filter(entry => entry.searchTerm !== term);
    localStorage.setItem(mainKey, JSON.stringify(main));
    if (currentViewMode === mode && (currentTermForView === term || currentTermForView === null)) {
        currentTermForView = null;
        updateView();
    }
    refreshTopBar();
}

function restoreMovieFromTrash(movie, mode) {
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const term = movie.searchTerm;
    const termIndex = trash.findIndex(entry => entry.searchTerm === term);
    if (termIndex === -1) return;
    const termEntry = trash[termIndex];
    termEntry.results = termEntry.results.filter(m => m.id !== movie.id);
    if (termEntry.results.length === 0) trash.splice(termIndex, 1);
    else termEntry.date = new Date().toISOString();
    localStorage.setItem(trashKey, JSON.stringify(trash));
    const { deletedAt, ...movieClean } = movie;
    const mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    let mainTermEntry = main.find(entry => entry.searchTerm === term);
    if (mainTermEntry) {
        if (!mainTermEntry.results.some(m => m.id === movieClean.id)) {
            mainTermEntry.results.push(movieClean);
            mainTermEntry.results.sort((a,b) => new Date(b.date) - new Date(a.date));
            mainTermEntry.results = mainTermEntry.results.slice(0, MAX_RESULTS_PER_TERM);
            mainTermEntry.date = new Date().toISOString();
        }
    } else {
        main.unshift({ searchTerm: term, date: new Date().toISOString(), results: [movieClean] });
    }
    localStorage.setItem(mainKey, JSON.stringify(main));
    if (currentViewMode === mode || currentViewMode === (mode + '_trash')) {
        updateView();
        refreshTopBar();
    }
}

function restoreTermFromTrash(term, mode) {
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const trashTermIndex = trash.findIndex(entry => entry.searchTerm === term);
    if (trashTermIndex === -1) return;
    const cleanedMovies = trash[trashTermIndex].results.map(({ deletedAt, ...movie }) => movie);
    const mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    let mainTermEntry = main.find(entry => entry.searchTerm === term);
    if (mainTermEntry) {
        const existingIds = new Set(mainTermEntry.results.map(m => m.id));
        const newMovies = cleanedMovies.filter(m => !existingIds.has(m.id));
        if (newMovies.length) {
            mainTermEntry.results.push(...newMovies);
            mainTermEntry.results.sort((a,b) => new Date(b.date) - new Date(a.date));
            mainTermEntry.results = mainTermEntry.results.slice(0, MAX_RESULTS_PER_TERM);
            mainTermEntry.date = new Date().toISOString();
        }
    } else {
        main.unshift({ searchTerm: term, date: new Date().toISOString(), results: cleanedMovies.slice(0, MAX_RESULTS_PER_TERM) });
    }
    localStorage.setItem(mainKey, JSON.stringify(main));
    trash.splice(trashTermIndex, 1);
    localStorage.setItem(trashKey, JSON.stringify(trash));
    if (currentViewMode === mode || currentViewMode === (mode + '_trash')) {
        updateView();
        refreshTopBar();
    }
}

function emptyTrash(mode) {
    const trashKey = getTrashKey(mode);
    localStorage.setItem(trashKey, JSON.stringify([]));
    if (currentViewMode === (mode + '_trash')) {
        currentTermForView = null;
        updateView();
        refreshTopBar();
    }
}

// ========== FUNCIÓN PARA SALIR DE PAPELERA ==========
function exitTrashAndShowAll() {
    if (currentViewMode === 'filtered_trash') {
        currentViewMode = 'filtered';
    } else if (currentViewMode === 'excluded_trash') {
        currentViewMode = 'excluded';
    } else {
        currentTermForView = null;
        currentSort = 'date';
        updateView();
        return;
    }
    currentTermForView = null;
    currentSort = 'date';
    updateView();
    refreshTopBar();
    configureTrashButton();
    updateSettingsIcon();
    if (currentViewMode === 'excluded' || currentViewMode === 'excluded_trash') {
        modeToggle.classList.add('excluded-mode');
        document.body.classList.add('excluded-mode');
    } else {
        modeToggle.classList.remove('excluded-mode');
        document.body.classList.remove('excluded-mode');
    }
}

// ========== BÚSQUEDA PRINCIPAL (CON TÉRMINOS EXTRA Y "movie" POR DEFECTO) ==========
async function performSearch(query, forceOrderByViewCount = false) {
    if (isSettingsView) closeSettingsAndRestore();

    loadingDiv.style.display = 'flex';
    try {
        let finalQuery;
        if (query && query.trim() !== "") {
            finalQuery = query + EXTRA_SEARCH_TERMS;
        } else {
            finalQuery = "movie" + EXTRA_SEARCH_TERMS;
        }
        
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&channelId=${TARGET_CHANNEL_ID}&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(finalQuery)}&key=${API_KEY}`;
        
        const orderByViews = forceOrderByViewCount || (localStorage.getItem(SEARCH_ORDER_VIEW_COUNT) === 'true');
        if (orderByViews) {
            url += '&order=viewCount';
        }
        
        console.log("Fetching URL:", url);
        
        const searchResponse = await fetch(url);
        const searchData = await searchResponse.json();
        console.log("Search response:", searchData);
        
        if (!searchData.items || searchData.items.length === 0) {
            console.error("No items returned from API");
            resultsGrid.innerHTML = '<p class="stats">No movies found. Check console.</p>';
            loadingDiv.style.display = 'none';
            return;
        }
        
        const videoIds = searchData.items.map(item => item.id.videoId).filter(id => id);
        if (videoIds.length === 0) {
            loadingDiv.style.display = 'none';
            return;
        }
        
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`;
        const videosResponse = await fetch(videosUrl);
        const videosData = await videosResponse.json();
        
        const detailsMap = new Map();
        if (videosData.items) {
            videosData.items.forEach(video => {
                const snippet = video.snippet;
                const stats = video.statistics || {};
                const cd = video.contentDetails || {};
                detailsMap.set(video.id, {
                    fullDescription: snippet.description,
                    tags: snippet.tags || [],
                    viewCount: stats.viewCount || 'N/A',
                    likeCount: stats.likeCount || 'N/A',
                    commentCount: stats.commentCount || 'N/A',
                    duration: cd.duration || 'N/A',
                    channelId: snippet.channelId,
                    channelTitle: snippet.channelTitle,
                    title: snippet.title,
                    publishedAt: snippet.publishedAt,
                    thumbnails: snippet.thumbnails
                });
            });
        }
        
        const enrichedItems = searchData.items.map(item => {
            const videoId = item.id.videoId;
            const extra = detailsMap.get(videoId) || {};
            return {
                id: videoId,
                title: extra.title || item.snippet.title,
                channel: extra.channelTitle || item.snippet.channelTitle,
                channelId: extra.channelId || item.snippet.channelId,
                imageUrl: extra.thumbnails?.medium?.url || item.snippet.thumbnails.medium.url,
                url: `https://youtube.com/watch?v=${videoId}`,
                description: extra.fullDescription || item.snippet.description,
                publishedAt: extra.publishedAt || item.snippet.publishedAt,
                duration: extra.duration,
                viewCount: extra.viewCount,
                likeCount: extra.likeCount,
                commentCount: extra.commentCount,
                tags: extra.tags
            };
        });
        
        saveSearchResults(currentSearchTerm, enrichedItems);
        currentViewMode = 'filtered';
        currentTermForView = currentSearchTerm;
        currentSort = 'date';
        if (!isSettingsView) updateView();
        refreshTopBar();
        if (modeToggle.classList.contains('excluded-mode')) modeToggle.classList.remove('excluded-mode');
        if (document.body.classList.contains('excluded-mode')) document.body.classList.remove('excluded-mode');
        configureTrashButton();
        updateSettingsIcon();
    } catch (error) {
        console.error("Search error:", error);
        resultsGrid.innerHTML = `<p class="stats">Error: ${error.message}</p>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

async function performTopViewedSearch() {
    currentSearchTerm = "Top Viewed";
    await performSearch("", true);
}

// ========== MANEJADORES ==========
searchBtn.onclick = async () => {
    let baseQuery = searchInput.value.trim();
    if (baseQuery === "") {
        currentSearchTerm = "movie";
    } else {
        currentSearchTerm = baseQuery;
    }
    searchInput.value = '';
    await performSearch(currentSearchTerm);
};

function toggleMode() {
    if (isSettingsView) closeSettingsAndRestore();
    if (currentViewMode === 'filtered') currentViewMode = 'excluded';
    else if (currentViewMode === 'excluded') currentViewMode = 'filtered';
    else if (currentViewMode === 'filtered_trash') currentViewMode = 'excluded_trash';
    else if (currentViewMode === 'excluded_trash') currentViewMode = 'filtered_trash';
    currentTermForView = null;
    currentSort = 'date';
    updateView();
    if (currentViewMode === 'excluded' || currentViewMode === 'excluded_trash') {
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

// ========== BARRA SUPERIOR ==========
function refreshTopBar() {
    let storageKey;
    if (currentViewMode === 'filtered') storageKey = FILTERED_SEARCH_KEY;
    else if (currentViewMode === 'excluded') storageKey = EXCLUDED_SEARCH_KEY;
    else if (currentViewMode === 'filtered_trash') storageKey = FILTERED_TRASH_KEY;
    else if (currentViewMode === 'excluded_trash') storageKey = EXCLUDED_TRASH_KEY;
    else return;

    const searches = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const terms = searches.map(entry => entry.searchTerm).filter((v, i, a) => a.indexOf(v) === i);
    let filterIcon = (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') ? 'filter_alt' : 'video_search';
    let filterTitle = (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') ? 'Show all Free Movies' : 'Show all Excluded Results';

    let html = `<button class="full-search-btn material-symbols-outlined" id="unionIcon" title="${filterTitle}">${filterIcon}</button>
                <button class="full-search-btn material-symbols-outlined" id="topViewedBtn" title="Top 50 most viewed movies">trending_up</button>`;
    if (terms.length === 0) {
        html += '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">No recent searches in this mode.</div>';
    } else {
        html += terms.map(term => `
            <button class="full-search-btn tag-btn" data-term="${term}">
                ${term}
                <span class="history-delete" data-term="${term}">✖</span>
            </button>
        `).join('');
    }
    fullSearchDiv.innerHTML = html;

    const unionIcon = document.getElementById('unionIcon');
    if (unionIcon) {
        unionIcon.onclick = () => {
            if (isSettingsView) closeSettingsAndRestore();
            exitTrashAndShowAll();
        };
    }
    const topViewedBtn = document.getElementById('topViewedBtn');
    if (topViewedBtn) {
        topViewedBtn.onclick = () => {
            if (isSettingsView) closeSettingsAndRestore();
            performTopViewedSearch();
        };
    }
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.onclick = () => {
            if (isSettingsView) closeSettingsAndRestore();
            currentTermForView = btn.dataset.term;
            currentSort = 'date';
            updateView();
        };
    });
    document.querySelectorAll('.history-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const term = btn.dataset.term;
            if (isSettingsView) closeSettingsAndRestore();

            if (currentViewMode === 'filtered' || currentViewMode === 'excluded') {
                moveTermToTrash(term, currentViewMode);
            } else if (currentViewMode === 'filtered_trash' || currentViewMode === 'excluded_trash') {
                const trashKey = getTrashKey(currentViewMode);
                let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
                trash = trash.filter(entry => entry.searchTerm !== term);
                localStorage.setItem(trashKey, JSON.stringify(trash));
                if (currentTermForView === term) currentTermForView = null;
                updateView();
                refreshTopBar();
            }
        };
    });
}

function configureTrashButton() {
    if (currentViewMode === 'filtered') {
        clearStorageBtn.onclick = () => {
            if (isSettingsView) closeSettingsAndRestore();
            if (confirm('Delete ALL Free Movies data? (This will move them to trash)')) {
                let main = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
                for (const termEntry of main) moveTermToTrash(termEntry.searchTerm, 'filtered');
                refreshTopBar();
                if (currentViewMode === 'filtered') { currentTermForView = null; updateView(); }
            }
        };
        clearStorageBtn.title = 'Move all Free Movies to trash';
    } else if (currentViewMode === 'excluded') {
        clearStorageBtn.onclick = () => {
            if (isSettingsView) closeSettingsAndRestore();
            if (confirm('Delete ALL Excluded data? (This will move them to trash)')) {
                let main = JSON.parse(localStorage.getItem(EXCLUDED_SEARCH_KEY) || '[]');
                for (const termEntry of main) moveTermToTrash(termEntry.searchTerm, 'excluded');
                refreshTopBar();
                if (currentViewMode === 'excluded') { currentTermForView = null; updateView(); }
            }
        };
        clearStorageBtn.title = 'Move all Excluded data to trash';
    } else if (currentViewMode === 'filtered_trash') {
        clearStorageBtn.onclick = () => {
            if (isSettingsView) closeSettingsAndRestore();
            if (confirm('Empty trash for Free Movies? (All items will be permanently deleted)')) emptyTrash('filtered');
        };
        clearStorageBtn.title = 'Empty Free Movies trash';
    } else if (currentViewMode === 'excluded_trash') {
        clearStorageBtn.onclick = () => {
            if (isSettingsView) closeSettingsAndRestore();
            if (confirm('Empty trash for Excluded Results? (All items will be permanently deleted)')) emptyTrash('excluded');
        };
        clearStorageBtn.title = 'Empty Excluded Results trash';
    }
}

function init() {
    refreshTopBar();
    configureTrashButton();
    currentViewMode = 'filtered';
    currentTermForView = null;
    currentSort = 'date';
    isSettingsView = false;
    updateView();   // Solo muestra datos guardados, NO hace fetch
    updateSettingsIcon();
    settingsBtn.onclick = () => {
        if (!isSettingsView) {
            showSettings();
        } else {
            closeSettingsAndRestore();
        }
    };
}
init();

// ========== MODAL ==========
function openModal(movie, sourceMode) {
    if (!modal) return;
    let formattedDuration = 'Unknown';
    if (movie.duration && movie.duration !== 'N/A') {
        const match = movie.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        const hours = (match[1] ? match[1].slice(0,-1) : 0);
        const minutes = (match[2] ? match[2].slice(0,-1) : 0);
        const seconds = (match[3] ? match[3].slice(0,-1) : 0);
        formattedDuration = `${hours ? hours+':' : ''}${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    }
    const isInTrash = sourceMode.includes('trash');
    const mode = sourceMode.includes('filtered') ? 'filtered' : 'excluded';
    modalBody.innerHTML = `
        <div class="modal-header">
            <span class="material-symbols-outlined modal-delete-btn">delete_forever</span>
            <h2>${escapeHtml(movie.title)}</h2>
            <div style="width: 20px;"></div>
        </div>
        <img src="${movie.imageUrl}" style="width:100%; border-radius:8px; margin:10px 0;">
        <p><strong>YouTube Premiere:</strong> ${movie.publishedAt ? new Date(movie.publishedAt).toLocaleDateString() : 'Unknown'}</p>
        <div class="modal-description">${escapeHtml(movie.description || 'No Description')}</div>
        <p><strong>Duration:</strong> ${formattedDuration}</p>
        <p><strong>Search performed:</strong> ${new Date(movie.date).toLocaleString()}</p>
        <p><strong>Key Word:</strong> ${escapeHtml(movie.searchTerm)}</p>
        ${isInTrash ? `
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="restoreBtn" class="full-search-btn">Restore</button>
                <button id="permanentDeleteBtn" class="full-search-btn" style="background:#990000;">Delete Permanently</button>
            </div>
        ` : ''}
    `;
    const prefKey = (mode === 'filtered') ? SHOW_EXTRA_FILTERED : SHOW_EXTRA_EXCLUDED;
    const showExtra = localStorage.getItem(prefKey) === 'true';
    if (showExtra) {
        const extraDiv = document.createElement('div');
        extraDiv.className = 'modal-extra-info';
        let tagsHtml = movie.tags && movie.tags.length ? `<li><strong>Tags:</strong> ${escapeHtml(movie.tags.join(', '))}</li>` : '';
        extraDiv.innerHTML = `<ul>
            <li><strong>ID del video:</strong> ${escapeHtml(movie.id)}</li>
            <li><strong>Canal:</strong> ${escapeHtml(movie.channel)}</li>
            <li><strong>URL:</strong> ${escapeHtml(movie.url)}</li>
            <li><strong>Views:</strong> ${movie.viewCount || 'N/A'}</li>
            <li><strong>Likes:</strong> ${movie.likeCount || 'N/A'}</li>
            <li><strong>Comments:</strong> ${movie.commentCount || 'N/A'}</li>
            ${tagsHtml}
        </ul>`;
        modalBody.appendChild(extraDiv);
    }
    currentMovieUrl = movie.url;
    modal.style.display = 'flex';

    const deleteBtn = modalBody.querySelector('.modal-delete-btn');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (isInTrash) {
                const trashKey = getTrashKey(mode);
                let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
                let termEntry = trash.find(entry => entry.searchTerm === movie.searchTerm);
                if (termEntry) {
                    termEntry.results = termEntry.results.filter(m => m.id !== movie.id);
                    if (termEntry.results.length === 0) trash = trash.filter(entry => entry.searchTerm !== movie.searchTerm);
                    localStorage.setItem(trashKey, JSON.stringify(trash));
                }
                modal.style.display = 'none';
                if (currentViewMode === (mode + '_trash')) updateView();
                refreshTopBar();
            } else {
                moveMovieToTrash(movie, mode);
                modal.style.display = 'none';
                if (currentViewMode === mode) updateView();
                refreshTopBar();
            }
        };
    }

    if (isInTrash) {
        const restoreBtn = document.getElementById('restoreBtn');
        if (restoreBtn) {
            restoreBtn.onclick = () => {
                restoreMovieFromTrash(movie, mode);
                modal.style.display = 'none';
                if (currentViewMode === (mode + '_trash')) updateView();
                refreshTopBar();
            };
        }
        const permanentDeleteBtn = document.getElementById('permanentDeleteBtn');
        if (permanentDeleteBtn) {
            permanentDeleteBtn.onclick = () => {
                const trashKey = getTrashKey(mode);
                let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
                let termEntry = trash.find(entry => entry.searchTerm === movie.searchTerm);
                if (termEntry) {
                    termEntry.results = termEntry.results.filter(m => m.id !== movie.id);
                    if (termEntry.results.length === 0) trash = trash.filter(entry => entry.searchTerm !== movie.searchTerm);
                    localStorage.setItem(trashKey, JSON.stringify(trash));
                }
                modal.style.display = 'none';
                if (currentViewMode === (mode + '_trash')) updateView();
                refreshTopBar();
            };
        }
    }
}

if (closeModal) closeModal.onclick = () => { modal.style.display = 'none'; };
if (watchBtn) watchBtn.onclick = () => window.open(currentMovieUrl);
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };