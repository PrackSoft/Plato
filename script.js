// script.js - Con papeleras (trash) independientes por modo
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL_ID = 'UCuVPpxrm2VAgpH3Ktln4HXg';
const SEARCH_MODE = 'channel';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RESULTS_PER_TERM = 500;
const MAX_TRASH_PER_TERM = 200; // Límite de películas por término en la papelera
const FILTERED_SEARCH_KEY = 'plato_filtered_searches';
const EXCLUDED_SEARCH_KEY = 'plato_excluded_searches';
const FILTERED_TRASH_KEY = 'plato_filtered_trash';
const EXCLUDED_TRASH_KEY = 'plato_excluded_trash';

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
let currentViewMode = 'filtered'; // 'filtered', 'excluded', 'filtered_trash', 'excluded_trash'
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

// Renderizado común (usa resultsGrid, resultsStats, resultsTitle)
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
                <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")}, ${currentViewMode})'>
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
            <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")}, ${currentViewMode})'>
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

// Actualiza la vista según currentViewMode, currentTermForView, currentSort
function updateView() {
    if (isSettingsView) return;
    let storageKey, titlePrefixBase;
    const isTrash = currentViewMode.includes('trash');
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
    }

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
    renderMovies(movies, currentSort, titlePrefix);
}

function updateSettingsIcon() {
    if (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') {
        settingsBtn.innerHTML = 'settings_heart';
        settingsBtn.title = 'Settings for Free Movies';
    } else {
        settingsBtn.innerHTML = 'video_settings';
        settingsBtn.title = 'Settings for Excluded Results';
    }
}

// Muestra la vista de ajustes (ya existente)
function showSettings() {
    previousViewState = {
        viewMode: currentViewMode,
        termForView: currentTermForView,
        sort: currentSort
    };
    isSettingsView = true;
    resultsTitle.innerText = 'Settings';
    const currentPrefKey = (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') ? SHOW_EXTRA_FILTERED : SHOW_EXTRA_EXCLUDED;
    const currentPrefValue = localStorage.getItem(currentPrefKey) === 'true';
    // Añadir botón para ir a la papelera (si no estamos ya en ella)
    const trashLink = `<button id="goToTrashBtn" class="secondary-btn" style="background: #2a2a2a; padding: 8px 20px; border-radius: 20px; margin-top: 20px;">🗑️ Go to Trash</button>`;
    resultsGrid.innerHTML = `
        <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
            <h3 style="margin-bottom: 20px;">Display options for ${(currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') ? 'Free Movies' : 'Excluded Results'}</h3>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input type="checkbox" id="showExtraInfoCheckbox" ${currentPrefValue ? 'checked' : ''}>
                <span>Show technical information in movie modal (ID, dates, etc.)</span>
            </label>
            <div style="margin-top: 30px;">
                <button id="backFromSettingsBtn" class="secondary-btn" style="background: #2a2a2a; padding: 8px 20px; border-radius: 20px;">← Back</button>
            </div>
            ${trashLink}
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
            if (currentViewMode === 'excluded' || currentViewMode === 'excluded_trash') {
                modeToggle.classList.add('excluded-mode');
                document.body.classList.add('excluded-mode');
            } else {
                modeToggle.classList.remove('excluded-mode');
                document.body.classList.remove('excluded-mode');
            }
        };
    }
    const goToTrashBtn = document.getElementById('goToTrashBtn');
    if (goToTrashBtn) {
        goToTrashBtn.onclick = () => {
            isSettingsView = false;
            if (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') {
                currentViewMode = 'filtered_trash';
            } else {
                currentViewMode = 'excluded_trash';
            }
            currentTermForView = null;
            currentSort = 'date';
            updateView();
            refreshTopBar();        // refrescará la barra con los tags de la papelera (si los hubiera)
            configureTrashButton(); // el botón de borrar todo ahora vaciará la papelera
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

// Guardar resultados enriquecidos (sin cambios, ya guarda en las claves principales)
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
        if (item.channelId === TARGET_CHANNEL_ID) {
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

// ========== GESTIÓN DE PAPELERA ==========
function getTrashKey(mode) {
    return (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_TRASH_KEY : EXCLUDED_TRASH_KEY;
}

// Mover una película individual a la papelera
function moveMovieToTrash(movie, mode) {
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const term = movie.searchTerm;
    let termEntry = trash.find(entry => entry.searchTerm === term);
    if (!termEntry) {
        termEntry = { searchTerm: term, date: new Date().toISOString(), results: [] };
        trash.unshift(termEntry);
    }
    // Añadir la película con deletedAt
    const movieWithDeleted = { ...movie, deletedAt: new Date().toISOString() };
    // Evitar duplicados (si ya existe en la papelera, no añadir de nuevo)
    const exists = termEntry.results.some(m => m.id === movie.id);
    if (!exists) {
        termEntry.results.push(movieWithDeleted);
        // Ordenar por deletedAt descendente (más reciente primero) y truncar a MAX_TRASH_PER_TERM
        termEntry.results.sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        termEntry.results = termEntry.results.slice(0, MAX_TRASH_PER_TERM);
        termEntry.date = new Date().toISOString(); // actualizar fecha del término
    }
    // Guardar papelera
    localStorage.setItem(trashKey, JSON.stringify(trash));
    // Eliminar la película de la bolsa principal
    let mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    let termMain = main.find(entry => entry.searchTerm === term);
    if (termMain) {
        termMain.results = termMain.results.filter(m => m.id !== movie.id);
        if (termMain.results.length === 0) {
            main = main.filter(entry => entry.searchTerm !== term);
        } else {
            // actualizar fecha del término (por si acaso)
            termMain.date = new Date().toISOString();
        }
        localStorage.setItem(mainKey, JSON.stringify(main));
    }
    // Actualizar la vista si es necesario
    if (currentViewMode === mode && currentTermForView === term) {
        updateView();
    } else if (currentViewMode === mode && currentTermForView === null) {
        updateView();
    }
    refreshTopBar(); // actualiza los tags de la vista principal (puede desaparecer el tag si se vació)
}

// Mover un término completo a la papelera
function moveTermToTrash(term, mode) {
    const mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    const termEntry = main.find(entry => entry.searchTerm === term);
    if (!termEntry) return;
    // Copiar todas las películas del término a la papelera, añadiendo deletedAt
    const moviesWithDeleted = termEntry.results.map(movie => ({ ...movie, deletedAt: new Date().toISOString() }));
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    let trashTermEntry = trash.find(entry => entry.searchTerm === term);
    if (trashTermEntry) {
        // Fusionar, evitando duplicados por id
        const existingIds = new Set(trashTermEntry.results.map(m => m.id));
        const newMovies = moviesWithDeleted.filter(m => !existingIds.has(m.id));
        trashTermEntry.results.push(...newMovies);
        trashTermEntry.results.sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        trashTermEntry.results = trashTermEntry.results.slice(0, MAX_TRASH_PER_TERM);
        trashTermEntry.date = new Date().toISOString();
    } else {
        trash.unshift({
            searchTerm: term,
            date: new Date().toISOString(),
            results: moviesWithDeleted.slice(0, MAX_TRASH_PER_TERM)
        });
    }
    localStorage.setItem(trashKey, JSON.stringify(trash));
    // Eliminar el término de la bolsa principal
    main = main.filter(entry => entry.searchTerm !== term);
    localStorage.setItem(mainKey, JSON.stringify(main));
    // Actualizar vista
    if (currentViewMode === mode && (currentTermForView === term || currentTermForView === null)) {
        currentTermForView = null;
        currentSort = 'date';
        updateView();
    }
    refreshTopBar();
}

// Restaurar una película desde la papelera
function restoreMovieFromTrash(movie, mode) {
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const term = movie.searchTerm;
    const termIndex = trash.findIndex(entry => entry.searchTerm === term);
    if (termIndex === -1) return;
    const termEntry = trash[termIndex];
    // Eliminar la película de la papelera
    const newResults = termEntry.results.filter(m => m.id !== movie.id);
    if (newResults.length === 0) {
        trash.splice(termIndex, 1);
    } else {
        termEntry.results = newResults;
        termEntry.date = new Date().toISOString();
    }
    localStorage.setItem(trashKey, JSON.stringify(trash));
    // Añadir la película a la bolsa principal (sin el campo deletedAt)
    const { deletedAt, ...movieClean } = movie;
    const mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    let mainTermEntry = main.find(entry => entry.searchTerm === term);
    if (mainTermEntry) {
        const exists = mainTermEntry.results.some(m => m.id === movieClean.id);
        if (!exists) {
            mainTermEntry.results.push(movieClean);
            mainTermEntry.results.sort((a,b) => new Date(b.date) - new Date(a.date));
            mainTermEntry.results = mainTermEntry.results.slice(0, MAX_RESULTS_PER_TERM);
            mainTermEntry.date = new Date().toISOString();
        }
    } else {
        main.unshift({
            searchTerm: term,
            date: new Date().toISOString(),
            results: [movieClean]
        });
    }
    localStorage.setItem(mainKey, JSON.stringify(main));
    // Actualizar vista si estamos en la papelera o en principal
    if (currentViewMode === mode || currentViewMode === (mode + '_trash')) {
        updateView();
        refreshTopBar();
    }
}

// Restaurar un término completo desde la papelera
function restoreTermFromTrash(term, mode) {
    const trashKey = getTrashKey(mode);
    let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
    const trashTermIndex = trash.findIndex(entry => entry.searchTerm === term);
    if (trashTermIndex === -1) return;
    const trashTermEntry = trash[trashTermIndex];
    // Eliminar el campo deletedAt de cada película
    const cleanedMovies = trashTermEntry.results.map(({ deletedAt, ...movie }) => movie);
    // Añadir a la bolsa principal
    const mainKey = (mode === 'filtered' || mode === 'filtered_trash') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
    let mainTermEntry = main.find(entry => entry.searchTerm === term);
    if (mainTermEntry) {
        const existingIds = new Set(mainTermEntry.results.map(m => m.id));
        const newMovies = cleanedMovies.filter(m => !existingIds.has(m.id));
        mainTermEntry.results.push(...newMovies);
        mainTermEntry.results.sort((a,b) => new Date(b.date) - new Date(a.date));
        mainTermEntry.results = mainTermEntry.results.slice(0, MAX_RESULTS_PER_TERM);
        mainTermEntry.date = new Date().toISOString();
    } else {
        main.unshift({
            searchTerm: term,
            date: new Date().toISOString(),
            results: cleanedMovies.slice(0, MAX_RESULTS_PER_TERM)
        });
    }
    localStorage.setItem(mainKey, JSON.stringify(main));
    // Eliminar el término de la papelera
    trash.splice(trashTermIndex, 1);
    localStorage.setItem(trashKey, JSON.stringify(trash));
    // Actualizar vista
    if (currentViewMode === mode || currentViewMode === (mode + '_trash')) {
        updateView();
        refreshTopBar();
    }
}

// Vaciar toda la papelera (modo actual)
function emptyTrash(mode) {
    const trashKey = getTrashKey(mode);
    localStorage.setItem(trashKey, JSON.stringify([]));
    if (currentViewMode === (mode + '_trash')) {
        currentTermForView = null;
        updateView();
        refreshTopBar();
    }
}

// ========== BARRA SUPERIOR (tags) ==========
function refreshTopBar() {
    // Los tags se muestran según la vista actual (principal o papelera)
    let storageKey;
    if (currentViewMode === 'filtered') storageKey = FILTERED_SEARCH_KEY;
    else if (currentViewMode === 'excluded') storageKey = EXCLUDED_SEARCH_KEY;
    else if (currentViewMode === 'filtered_trash') storageKey = FILTERED_TRASH_KEY;
    else if (currentViewMode === 'excluded_trash') storageKey = EXCLUDED_TRASH_KEY;
    else return;

    const searches = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const terms = searches.map(entry => entry.searchTerm).filter((v,i,a)=>a.indexOf(v)===i);
    let filterIcon, filterTitle;
    if (currentViewMode === 'filtered' || currentViewMode === 'filtered_trash') {
        filterIcon = 'filter_alt';
        filterTitle = 'Show all Free Movies';
    } else {
        filterIcon = 'video_search';
        filterTitle = 'Show all Excluded Results';
    }
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
    // La X ahora mueve el término completo a la papelera (si estamos en vista principal) o lo elimina definitivamente si estamos en papelera?
    // Decidido: en vista principal, mover a papelera; en papelera, eliminar definitivamente.
    document.querySelectorAll('.history-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const term = btn.dataset.term;
            if (currentViewMode === 'filtered' || currentViewMode === 'excluded') {
                // Mover a papelera
                moveTermToTrash(term, currentViewMode);
            } else if (currentViewMode === 'filtered_trash' || currentViewMode === 'excluded_trash') {
                // Eliminar definitivamente de la papelera
                const trashKey = getTrashKey(currentViewMode);
                let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
                trash = trash.filter(entry => entry.searchTerm !== term);
                localStorage.setItem(trashKey, JSON.stringify(trash));
                if (currentTermForView === term) {
                    currentTermForView = null;
                    currentSort = 'date';
                    updateView();
                } else {
                    updateView();
                }
                refreshTopBar(); // actualizar tags de la papelera
            }
        };
    });
}

// ========== BOTÓN DE BORRAR (según modo) ==========
function configureTrashButton() {
    if (currentViewMode === 'filtered') {
        clearStorageBtn.onclick = () => {
            if (confirm('Delete ALL Free Movies data? (This will move them to trash)')) {
                // Mover todas las películas a la papelera (término a término)
                const mainKey = FILTERED_SEARCH_KEY;
                let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
                for (const termEntry of main) {
                    moveTermToTrash(termEntry.searchTerm, 'filtered');
                }
                // Después de mover, actualizar vista
                refreshTopBar();
                if (currentViewMode === 'filtered') {
                    currentTermForView = null;
                    currentSort = 'date';
                    updateView();
                }
            }
        };
        clearStorageBtn.title = 'Move all Free Movies to trash';
    } else if (currentViewMode === 'excluded') {
        clearStorageBtn.onclick = () => {
            if (confirm('Delete ALL Excluded data? (This will move them to trash)')) {
                const mainKey = EXCLUDED_SEARCH_KEY;
                let main = JSON.parse(localStorage.getItem(mainKey) || '[]');
                for (const termEntry of main) {
                    moveTermToTrash(termEntry.searchTerm, 'excluded');
                }
                refreshTopBar();
                if (currentViewMode === 'excluded') {
                    currentTermForView = null;
                    currentSort = 'date';
                    updateView();
                }
            }
        };
        clearStorageBtn.title = 'Move all Excluded data to trash';
    } else if (currentViewMode === 'filtered_trash') {
        clearStorageBtn.onclick = () => {
            if (confirm('Empty trash for Free Movies? (All items will be permanently deleted)')) {
                emptyTrash('filtered');
            }
        };
        clearStorageBtn.title = 'Empty Free Movies trash';
    } else if (currentViewMode === 'excluded_trash') {
        clearStorageBtn.onclick = () => {
            if (confirm('Empty trash for Excluded Results? (All items will be permanently deleted)')) {
                emptyTrash('excluded');
            }
        };
        clearStorageBtn.title = 'Empty Excluded Results trash';
    }
}

// ========== BÚSQUEDA PRINCIPAL ==========
async function performSearch(query) {
    loadingDiv.style.display = 'flex';
    try {
        let url;
        if (SEARCH_MODE === 'channel') {
            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&channelId=${TARGET_CHANNEL_ID}&q=${encodeURIComponent(query)}&maxResults=${MAX_RESULTS_PER_PAGE}&key=${API_KEY}`;
        } else {
            const keywords = query + ' Películas Gratis YouTube Películas y TV de YouTube';
            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(keywords)}&key=${API_KEY}`;
        }
        const searchResponse = await fetch(url);
        const searchData = await searchResponse.json();
        if (!searchData.items) return;

        const videoIds = searchData.items.map(item => item.id.videoId).filter(id => id);
        if (videoIds.length === 0) return;

        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`;
        const videosResponse = await fetch(videosUrl);
        const videosData = await videosResponse.json();

        const detailsMap = new Map();
        if (videosData.items) {
            videosData.items.forEach(video => {
                const snippet = video.snippet;
                const statistics = video.statistics || {};
                const contentDetails = video.contentDetails || {};
                detailsMap.set(video.id, {
                    fullDescription: snippet.description,
                    tags: snippet.tags || [],
                    viewCount: statistics.viewCount || 'N/A',
                    likeCount: statistics.likeCount || 'N/A',
                    commentCount: statistics.commentCount || 'N/A',
                    duration: contentDetails.duration || 'N/A',
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
        if (isSettingsView) {
            const backBtn = document.getElementById('backFromSettingsBtn');
            if (backBtn) backBtn.click();
        }
    } catch (error) {
        resultsGrid.innerHTML = `<p class="stats">Error: ${error.message}</p>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

searchBtn.onclick = async () => {
    const baseQuery = searchInput.value.trim();
    if (!baseQuery) return;
    currentSearchTerm = baseQuery;
    searchInput.value = '';
    await performSearch(currentSearchTerm);
};

function toggleMode() {
    if (isSettingsView) return;
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

// ========== MODAL CON OPCIONES DE PAPELERA ==========
function openModal(movie, sourceMode) {
    if (!modal) return;
    // Formatear duración
    let formattedDuration = 'Unknown';
    if (movie.duration && movie.duration !== 'N/A') {
        const match = movie.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        const hours = (match[1] ? match[1].slice(0,-1) : 0);
        const minutes = (match[2] ? match[2].slice(0,-1) : 0);
        const seconds = (match[3] ? match[3].slice(0,-1) : 0);
        formattedDuration = `${hours ? hours+':' : ''}${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    }

    // Determinar si estamos en papelera (sourceMode contiene 'trash')
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
        let tagsHtml = '';
        if (movie.tags && movie.tags.length) {
            tagsHtml = `<li><strong>Tags:</strong> ${escapeHtml(movie.tags.join(', '))}</li>`;
        }
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
                // Eliminar permanentemente de la papelera
                const trashKey = getTrashKey(mode);
                let trash = JSON.parse(localStorage.getItem(trashKey) || '[]');
                let termEntry = trash.find(entry => entry.searchTerm === movie.searchTerm);
                if (termEntry) {
                    termEntry.results = termEntry.results.filter(m => m.id !== movie.id);
                    if (termEntry.results.length === 0) {
                        trash = trash.filter(entry => entry.searchTerm !== movie.searchTerm);
                    }
                    localStorage.setItem(trashKey, JSON.stringify(trash));
                }
                modal.style.display = 'none';
                if (currentViewMode === (mode + '_trash')) updateView();
                refreshTopBar();
            } else {
                // Mover a papelera
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
                    if (termEntry.results.length === 0) {
                        trash = trash.filter(entry => entry.searchTerm !== movie.searchTerm);
                    }
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