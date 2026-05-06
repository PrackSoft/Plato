// script.js - Separación total: FILTERED (trigo) y EXCLUDED (paja), sin duplicados
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RESULTS_PER_TERM = 500;
const STORAGE_KEY = 'plato_search_history';            // Lista de términos buscados
const FILTERED_SEARCH_KEY = 'plato_filtered_searches'; // Trigo: channel === TARGET_CHANNEL
const EXCLUDED_SEARCH_KEY = 'plato_excluded_searches'; // Paja: channel !== TARGET_CHANNEL

const searchBtn = document.getElementById('searchBtn');
const fullSearchBtn = document.getElementById('fullSearchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const resultsTitle = document.getElementById('resultsTitle');
const resultsStats = document.getElementById('resultsStats');
const loadingDiv = document.getElementById('loading');
const fullSearchDiv = document.getElementById('fullSearch');
const clearStorageBtn = document.getElementById('clearStorageBtn');
const modal = document.getElementById('movieModal');
const closeModal = document.querySelector('.close-modal');
const modalBody = document.getElementById('modalBody');
const watchBtn = document.getElementById('watchMovieBtn');
let currentMovieUrl = '';

let nextPageToken = null;
let currentQuery = '';
let allResults = [];
let currentSearchTerm = '';
let currentViewMode = 'filtered'; // 'filtered' (trigo) o 'excluded' (paja)
let currentSort = 'date';
let currentTermForView = null;     // null = unión de todos los términos, string = término específico

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
    } else { // date
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
            updateView();
        };
    });
}

function updateView() {
    let movies = [];
    const searchKey = (currentViewMode === 'filtered') ? FILTERED_SEARCH_KEY : EXCLUDED_SEARCH_KEY;
    const searches = JSON.parse(localStorage.getItem(searchKey) || '[]');
    if (currentTermForView) {
        const termData = searches.find(item => item.searchTerm === currentTermForView);
        movies = termData ? termData.results : [];
    } else {
        const allMovies = [];
        searches.forEach(entry => { allMovies.push(...entry.results); });
        const unique = [];
        const ids = new Set();
        allMovies.forEach(m => {
            if (!ids.has(m.id)) {
                ids.add(m.id);
                unique.push(m);
            }
        });
        movies = unique;
    }
    let titlePrefix = '';
    if (currentViewMode === 'filtered') {
        titlePrefix = currentTermForView ? `Free Movies: "${currentTermForView}" (${currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel')})` : `All Saved Free Movies (${currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel')})`;
    } else {
        titlePrefix = currentTermForView ? `Excluded (Non‑Free) results for "${currentTermForView}" (${currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel')})` : `All Excluded Results (${currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel')})`;
    }
    renderMovies(movies, currentSort, titlePrefix);
}

// Guarda por separado: trigo (filtered) y paja (excluded)
function saveSearchResults(searchTerm, rawItems) {
    // 1. Separar items
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
        if (item.snippet.channelTitle === TARGET_CHANNEL) {
            filteredItems.push(movie);
        } else {
            excludedItems.push(movie);
        }
    });

    // 2. Actualizar almacén de filtrados (trigo)
    let filteredSearches = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
    let filteredIndex = filteredSearches.findIndex(entry => entry.searchTerm === searchTerm);
    let existingFiltered = filteredIndex !== -1 ? filteredSearches[filteredIndex].results : [];
    let combinedFiltered = [...existingFiltered, ...filteredItems];
    const uniqueFiltered = [];
    const filteredIds = new Set();
    for (const m of combinedFiltered) {
        if (!filteredIds.has(m.id)) {
            filteredIds.add(m.id);
            uniqueFiltered.push(m);
        }
    }
    uniqueFiltered.sort((a,b) => new Date(b.date) - new Date(a.date));
    const limitedFiltered = uniqueFiltered.slice(0, MAX_RESULTS_PER_TERM);
    const filteredEntry = { searchTerm, date: new Date().toISOString(), results: limitedFiltered };
    if (filteredIndex !== -1) filteredSearches[filteredIndex] = filteredEntry;
    else filteredSearches.unshift(filteredEntry);
    localStorage.setItem(FILTERED_SEARCH_KEY, JSON.stringify(filteredSearches.slice(0, 20)));

    // 3. Actualizar almacén de excluidos (paja)
    let excludedSearches = JSON.parse(localStorage.getItem(EXCLUDED_SEARCH_KEY) || '[]');
    let excludedIndex = excludedSearches.findIndex(entry => entry.searchTerm === searchTerm);
    let existingExcluded = excludedIndex !== -1 ? excludedSearches[excludedIndex].results : [];
    let combinedExcluded = [...existingExcluded, ...excludedItems];
    const uniqueExcluded = [];
    const excludedIds = new Set();
    for (const m of combinedExcluded) {
        if (!excludedIds.has(m.id)) {
            excludedIds.add(m.id);
            uniqueExcluded.push(m);
        }
    }
    uniqueExcluded.sort((a,b) => new Date(b.date) - new Date(a.date));
    const limitedExcluded = uniqueExcluded.slice(0, MAX_RESULTS_PER_TERM);
    const excludedEntry = { searchTerm, date: new Date().toISOString(), results: limitedExcluded };
    if (excludedIndex !== -1) excludedSearches[excludedIndex] = excludedEntry;
    else excludedSearches.unshift(excludedEntry);
    localStorage.setItem(EXCLUDED_SEARCH_KEY, JSON.stringify(excludedSearches.slice(0, 20)));
}

function updateTags() {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!fullSearchDiv) return;
    if (history.length === 0) {
        fullSearchDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">No recent searches.</div>';
        return;
    }
    fullSearchDiv.innerHTML = '<button class="full-search-btn material-symbols-outlined" id="historyIcon">filter_alt</button>' +
        history.map(term => `
            <button class="full-search-btn tag-btn" data-term="${term}">
                ${term}
                <span class="history-delete" data-term="${term}">✖</span>
            </button>
        `).join('');
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.onclick = () => {
            currentViewMode = 'filtered';      // Los tags muestran el trigo (Free Movies) de ese término
            currentTermForView = btn.dataset.term;
            currentSort = 'date';
            updateView();
        };
    });
    document.querySelectorAll('.history-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const term = btn.dataset.term;
            deleteSearchTerm(term);
        };
    });
    const historyIcon = document.getElementById('historyIcon');
    if (historyIcon) {
        historyIcon.onclick = () => {
            currentViewMode = 'filtered';
            currentTermForView = null;
            currentSort = 'date';
            updateView();
        };
    }
}

function deleteSearchTerm(term) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history = history.filter(t => t !== term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    let filtered = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
    filtered = filtered.filter(entry => entry.searchTerm !== term);
    localStorage.setItem(FILTERED_SEARCH_KEY, JSON.stringify(filtered));
    let excluded = JSON.parse(localStorage.getItem(EXCLUDED_SEARCH_KEY) || '[]');
    excluded = excluded.filter(entry => entry.searchTerm !== term);
    localStorage.setItem(EXCLUDED_SEARCH_KEY, JSON.stringify(excluded));
    updateTags();
    if ((currentViewMode === 'filtered' && currentTermForView === term) || (currentViewMode === 'excluded' && currentTermForView === term)) {
        currentViewMode = 'filtered';
        currentTermForView = null;
        currentSort = 'date';
        updateView();
    } else {
        updateView();
    }
}

async function performSearch(query) {
    loadingDiv.style.display = 'flex';
    try {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(query + ' Películas Gratis YouTube Películas y TV de YouTube')}&key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items) {
            saveSearchResults(currentSearchTerm, data.items);
            currentViewMode = 'filtered';
            currentTermForView = currentSearchTerm;
            currentSort = 'date';
            updateView();
            let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!history.includes(currentSearchTerm)) {
                history.unshift(currentSearchTerm);
                history = history.slice(0, 10);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                updateTags();
            } else {
                history = [currentSearchTerm, ...history.filter(t => t !== currentSearchTerm)];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                updateTags();
            }
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

fullSearchBtn.onclick = () => {
    currentViewMode = 'excluded';   // Full Search = paja (resultados no gratuitos)
    currentTermForView = null;      // unión de todos los términos
    currentSort = 'date';
    updateView();
};

clearStorageBtn.onclick = () => {
    if (confirm('Delete all search history and saved movies?')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(FILTERED_SEARCH_KEY);
        localStorage.removeItem(EXCLUDED_SEARCH_KEY);
        updateTags();
        currentViewMode = 'filtered';
        currentTermForView = null;
        currentSort = 'date';
        updateView();
        alert('All data cleared.');
    }
};

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
    currentMovieUrl = movie.url;
    modal.style.display = 'flex';
    const deleteBtn = modalBody.querySelector('.delete-movie-btn');
    if (deleteBtn) deleteBtn.onclick = () => {
        let filtered = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
        let excluded = JSON.parse(localStorage.getItem(EXCLUDED_SEARCH_KEY) || '[]');
        const removeFromArray = (arr, movieId) => {
            return arr.map(entry => ({ ...entry, results: entry.results.filter(m => m.id !== movieId) })).filter(entry => entry.results.length > 0);
        };
        const newFiltered = removeFromArray(filtered, movie.id);
        const newExcluded = removeFromArray(excluded, movie.id);
        localStorage.setItem(FILTERED_SEARCH_KEY, JSON.stringify(newFiltered));
        localStorage.setItem(EXCLUDED_SEARCH_KEY, JSON.stringify(newExcluded));
        updateView();
        modal.style.display = 'none';
    };
}
if (closeModal) closeModal.onclick = () => { modal.style.display = 'none'; };
if (watchBtn) watchBtn.onclick = () => window.open(currentMovieUrl);
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

updateTags();
currentViewMode = 'filtered';
currentTermForView = null;
currentSort = 'date';
updateView();