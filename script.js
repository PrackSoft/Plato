// script.js - Two buckets per term: filtered (Free) and raw (Full)
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RESULTS_PER_TERM = 500;
const STORAGE_KEY = 'plato_search_history';      // List of terms (tags)
const RAW_SEARCH_KEY = 'plato_raw_searches';      // Full results per term (unfiltered)
const FILTERED_SEARCH_KEY = 'plato_filtered_searches'; // Free Movies per term

// DOM elements
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
let currentViewMode = 'filtered'; // 'filtered' (Free) or 'raw' (Full)
let currentSort = 'date';
let currentTermForView = null; // null for global union, otherwise term string

// Helper: escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

// Helper: local date key YYYY-MM-DD
function getLocalDateKey(d) {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// Common sorting function
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

// Render movies into resultsGrid
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
        // Group by local date
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
        
        // Sort groups by date descending
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
        // Flat grid
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

// Update the view based on currentMode, currentTermForView, currentSort
function updateView() {
    let movies = [];
    if (currentViewMode === 'filtered') {
        // Free Movies: if term is specific, load from FILTERED_SEARCH_KEY for that term; else union of all terms
        if (currentTermForView) {
            const filteredSearches = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
            const termData = filteredSearches.find(item => item.searchTerm === currentTermForView);
            movies = termData ? termData.results : [];
        } else {
            const filteredSearches = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
            const allMovies = [];
            filteredSearches.forEach(entry => {
                allMovies.push(...entry.results);
            });
            // Remove duplicates by id across terms
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
        let titlePrefix = currentTermForView ? `Free Movies: "${currentTermForView}" (${currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel')})` : `All Saved Free Movies (${currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel')})`;
        renderMovies(movies, currentSort, titlePrefix);
    } else { // raw (Full Search) - union of all raw results
        const rawSearches = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
        let allMovies = [];
        rawSearches.forEach(entry => {
            allMovies.push(...entry.results);
        });
        const unique = [];
        const ids = new Set();
        allMovies.forEach(m => {
            if (!ids.has(m.id)) {
                ids.add(m.id);
                unique.push(m);
            }
        });
        movies = unique;
        let titlePrefix = `Full Search (all terms) (${currentSort === 'date' ? 'by date' : (currentSort === 'title' ? 'by title' : 'by channel')})`;
        renderMovies(movies, currentSort, titlePrefix);
    }
}

// Save raw and filtered results for a term
function saveSearchResults(searchTerm, rawItems) {
    // 1. Update raw bucket
    let rawSearches = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
    let rawIndex = rawSearches.findIndex(entry => entry.searchTerm === searchTerm);
    let rawExisting = rawIndex !== -1 ? rawSearches[rawIndex].results : [];
    let combinedRaw = [...rawExisting, ...rawItems.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        imageUrl: item.snippet.thumbnails.medium.url,
        url: `https://youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        searchTerm: searchTerm,
        date: new Date().toISOString()
    }))];
    // Remove duplicates by id
    const uniqueRaw = [];
    const rawIds = new Set();
    for (const movie of combinedRaw) {
        if (!rawIds.has(movie.id)) {
            rawIds.add(movie.id);
            uniqueRaw.push(movie);
        }
    }
    uniqueRaw.sort((a,b) => new Date(b.date) - new Date(a.date));
    const limitedRaw = uniqueRaw.slice(0, MAX_RESULTS_PER_TERM);
    const rawEntry = { searchTerm: searchTerm, date: new Date().toISOString(), results: limitedRaw };
    if (rawIndex !== -1) rawSearches[rawIndex] = rawEntry;
    else rawSearches.unshift(rawEntry);
    localStorage.setItem(RAW_SEARCH_KEY, JSON.stringify(rawSearches.slice(0, 20)));
    
    // 2. Update filtered bucket (only those with channel === TARGET_CHANNEL)
    let filteredSearches = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
    let filteredIndex = filteredSearches.findIndex(entry => entry.searchTerm === searchTerm);
    let filteredExisting = filteredIndex !== -1 ? filteredSearches[filteredIndex].results : [];
    const filteredItems = rawItems.filter(item => item.snippet.channelTitle === TARGET_CHANNEL).map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        imageUrl: item.snippet.thumbnails.medium.url,
        url: `https://youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        searchTerm: searchTerm,
        date: new Date().toISOString()
    }));
    let combinedFiltered = [...filteredExisting, ...filteredItems];
    const uniqueFiltered = [];
    const filteredIds = new Set();
    for (const movie of combinedFiltered) {
        if (!filteredIds.has(movie.id)) {
            filteredIds.add(movie.id);
            uniqueFiltered.push(movie);
        }
    }
    uniqueFiltered.sort((a,b) => new Date(b.date) - new Date(a.date));
    const limitedFiltered = uniqueFiltered.slice(0, MAX_RESULTS_PER_TERM);
    const filteredEntry = { searchTerm: searchTerm, date: new Date().toISOString(), results: limitedFiltered };
    if (filteredIndex !== -1) filteredSearches[filteredIndex] = filteredEntry;
    else filteredSearches.unshift(filteredEntry);
    localStorage.setItem(FILTERED_SEARCH_KEY, JSON.stringify(filteredSearches.slice(0, 20)));
}

// Update tags (history) – each tag shows Free Movies for that term
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
    
    // Tag click: show Free Movies for that term
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.onclick = () => {
            const term = btn.dataset.term;
            currentViewMode = 'filtered';
            currentTermForView = term;
            currentSort = 'date';
            updateView();
        };
    });
    
    // Delete tag
    document.querySelectorAll('.history-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const term = btn.dataset.term;
            deleteSearchTerm(term);
        };
    });
    
    // Filter icon: show all Free Movies (global)
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
    // Remove from history
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history = history.filter(t => t !== term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    // Remove from raw and filtered buckets
    let raw = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
    raw = raw.filter(entry => entry.searchTerm !== term);
    localStorage.setItem(RAW_SEARCH_KEY, JSON.stringify(raw));
    let filtered = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
    filtered = filtered.filter(entry => entry.searchTerm !== term);
    localStorage.setItem(FILTERED_SEARCH_KEY, JSON.stringify(filtered));
    updateTags();
    if ((currentViewMode === 'filtered' && currentTermForView === term) || (currentViewMode === 'raw' && currentTermForView === term)) {
        // If we deleted the term being viewed, fallback to global filtered
        currentViewMode = 'filtered';
        currentTermForView = null;
        currentSort = 'date';
        updateView();
    } else {
        updateView(); // refresh current view (maybe global changed)
    }
}

// Load search results from API (filtered and raw saved)
async function performSearch(query) {
    loadingDiv.style.display = 'flex';
    try {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(query + ' Películas Gratis YouTube Películas y TV de YouTube')}&key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.items) {
            saveSearchResults(currentSearchTerm, data.items);
            // After saving, show filtered results for this term
            currentViewMode = 'filtered';
            currentTermForView = currentSearchTerm;
            currentSort = 'date';
            updateView();
            // Update history tags
            let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!history.includes(currentSearchTerm)) {
                history.unshift(currentSearchTerm);
                history = history.slice(0, 10);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                updateTags();
            } else {
                // move to front
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

// Event listeners
searchBtn.onclick = async () => {
    const baseQuery = searchInput.value.trim();
    if (!baseQuery) return;
    currentSearchTerm = baseQuery;
    searchInput.value = '';
    await performSearch(currentSearchTerm);
};

fullSearchBtn.onclick = () => {
    currentViewMode = 'raw';
    currentTermForView = null;
    currentSort = 'date';
    updateView();
};

clearStorageBtn.onclick = () => {
    if (confirm('Delete all search history and saved movies?')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(RAW_SEARCH_KEY);
        localStorage.removeItem(FILTERED_SEARCH_KEY);
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
        // Delete this specific movie from both buckets where it appears
        let raw = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
        let filtered = JSON.parse(localStorage.getItem(FILTERED_SEARCH_KEY) || '[]');
        let updated = false;
        const removeFromArray = (arr, movieId) => {
            return arr.map(entry => ({ ...entry, results: entry.results.filter(m => m.id !== movieId) })).filter(entry => entry.results.length > 0);
        };
        const newRaw = removeFromArray(raw, movie.id);
        const newFiltered = removeFromArray(filtered, movie.id);
        if (newRaw.length !== raw.length || newFiltered.length !== filtered.length) updated = true;
        if (updated) {
            localStorage.setItem(RAW_SEARCH_KEY, JSON.stringify(newRaw));
            localStorage.setItem(FILTERED_SEARCH_KEY, JSON.stringify(newFiltered));
            updateView(); // refresh current view
        }
        modal.style.display = 'none';
    };
}

if (closeModal) closeModal.onclick = () => { modal.style.display = 'none'; };
if (watchBtn) watchBtn.onclick = () => window.open(currentMovieUrl);
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

// Initialize
updateTags();
currentViewMode = 'filtered';
currentTermForView = null;
currentSort = 'date';
updateView();