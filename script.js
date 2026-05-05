// script.js - Unified storage with accumulation of results for repeated searches
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;
const MAX_RESULTS_PER_TERM = 500; // Maximum number of accumulated results per search term
const STORAGE_KEY = 'plato_search_history';
const RAW_SEARCH_KEY = 'plato_raw_searches';

const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const statsDiv = document.getElementById('stats');

const fullSearchDiv = document.getElementById('fullSearch');
const fullSearchView = document.getElementById('fullSearchView');
const fullSearchResults = document.getElementById('fullSearchResults');
const fullSearchStats = document.getElementById('fullSearchStats');

const searchView = document.getElementById('searchView');
const historyView = document.getElementById('historyView');
const savedMoviesList = document.getElementById('savedMoviesList');
const historyStats = document.getElementById('historyStats');

const modal = document.getElementById('movieModal');
const closeModal = document.querySelector('.close-modal');
const modalBody = document.getElementById('modalBody');
const watchBtn = document.getElementById('watchMovieBtn');
let currentMovieUrl = '';

let nextPageToken = null;
let currentQuery = '';
let allResults = [];
let currentSearchTerm = '';

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function deleteMovieById(movieId) {
    if (!confirm('¿Eliminar esta película del historial guardado?')) return;
    let rawSearches = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
    let updated = false;
    rawSearches = rawSearches.map(entry => {
        const newResults = entry.results.filter(m => m.id !== movieId);
        if (newResults.length !== entry.results.length) updated = true;
        return { ...entry, results: newResults };
    }).filter(entry => entry.results.length > 0);
    if (updated) {
        localStorage.setItem(RAW_SEARCH_KEY, JSON.stringify(rawSearches));
    }
    if (historyView.style.display === 'block') loadSavedMovies();
    if (fullSearchView.style.display === 'block') {
        const titleH2 = document.querySelector('#fullSearchView .history-header h2');
        const match = titleH2?.innerText.match(/"([^"]+)"/);
        if (match) {
            const activeTerm = match[1];
            const rawData = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
            const search = rawData.find(item => item.searchTerm === activeTerm);
            if (search && search.results.length) {
                renderMovies(search.results, fullSearchResults, fullSearchStats, currentFullSort || 'date', activeTerm);
            }
        }
    }
}

function openModal(movie) {
    if (!modal) return;
    modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="delete-movie-btn material-symbols-outlined">delete_forever</span>
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
    
    const deleteBtn = document.querySelector('.delete-movie-btn');
    if (deleteBtn) deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteMovieById(movie.id);
        modal.style.display = 'none';
    };
}

if (closeModal) closeModal.onclick = () => { if (modal) modal.style.display = 'none'; };
if (watchBtn) watchBtn.onclick = () => window.open(currentMovieUrl);
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

function saveSearch(term) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history = [term, ...history.filter(t => t !== term)].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    displayHistory();
}

function deleteSearch(term) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history = history.filter(t => t !== term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    displayHistory();
}

function saveRawSearch(searchTerm, rawItems) {
    let rawSearches = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
    const existingIndex = rawSearches.findIndex(entry => entry.searchTerm === searchTerm);
    
    let existingResults = [];
    if (existingIndex !== -1) {
        existingResults = rawSearches[existingIndex].results;
    }
    
    // Merge new items with existing, avoiding duplicates by id
    const combined = [...existingResults, ...rawItems.map(item => ({
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
    
    // Remove duplicates (keep first occurrence based on id)
    const unique = [];
    const ids = new Set();
    for (const movie of combined) {
        if (!ids.has(movie.id)) {
            ids.add(movie.id);
            unique.push(movie);
        }
    }
    
    // Sort by date (newest first) and limit to MAX_RESULTS_PER_TERM
    unique.sort((a,b) => new Date(b.date) - new Date(a.date));
    const limited = unique.slice(0, MAX_RESULTS_PER_TERM);
    
    const newEntry = {
        searchTerm: searchTerm,
        date: new Date().toISOString(),
        results: limited
    };
    
    if (existingIndex !== -1) {
        rawSearches[existingIndex] = newEntry;
    } else {
        rawSearches.unshift(newEntry);
    }
    // Keep only last 20 search terms
    rawSearches = rawSearches.slice(0, 20);
    localStorage.setItem(RAW_SEARCH_KEY, JSON.stringify(rawSearches));
}

function displayHistory() {
    if (!fullSearchDiv) return;
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (history.length === 0) {
        fullSearchDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">No recent searches.</div>';
        return;
    }
    fullSearchDiv.innerHTML = '<button class="full-search-btn material-symbols-outlined" id="historyIcon">filter_alt</button>' +
        history.map(term => `
            <button class="full-search-btn" data-term="${term}">
                ${term}
                <span class="history-delete" data-term="${term}">✖</span>
            </button>
        `).join('');
    
    document.querySelectorAll('.full-search-btn').forEach(btn => {
        if (!btn.dataset.term) return;
        btn.onclick = () => {
            const term = btn.dataset.term;
            const rawData = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
            const search = rawData.find(item => item.searchTerm === term);
            if (search && search.results.length) {
                currentFullSort = 'date';
                renderMovies(search.results, fullSearchResults, fullSearchStats, currentFullSort, term);
                searchView.style.display = 'none';
                historyView.style.display = 'none';
                fullSearchView.style.display = 'block';
            } else {
                alert('There are no saved results for this term. Please perform a search first.');
            }
        };
    });
    
    document.querySelectorAll('.history-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            deleteSearch(btn.dataset.term);
        };
    });
    
    const historyIcon = document.getElementById('historyIcon');
    if (historyIcon) {
        historyIcon.onclick = () => {
            loadSavedMovies();
            searchView.style.display = 'none';
            historyView.style.display = 'block';
            fullSearchView.style.display = 'none';
        };
    }
}

let currentFullSort = 'date';

// Función auxiliar para obtener clave YYYY-MM-DD en zona local
function getLocalDateKey(d) {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// Función común de renderizado
function renderMovies(movies, container, statsContainer, sortBy, term = null) {
    let sorted = [...movies];
    const isDateSort = (sortBy === 'date');
    
    if (sortBy === 'title') {
        sorted.sort((a,b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'channel') {
        sorted.sort((a,b) => a.channel.localeCompare(b.channel));
    } else { // date
        sorted.sort((a,b) => new Date(b.date) - new Date(a.date));
    }
    
    if (sorted.length === 0) {
        container.innerHTML = `<p class="stats">No movies to display.</p>`;
        statsContainer.innerHTML = '';
        return;
    }
    
    // Agrupar por fecha tanto para savedMoviesList como para fullSearchResults cuando ordena por fecha
    const shouldGroup = isDateSort;
    
    if (shouldGroup) {
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
            html += `<div class="date-group">`;
            html += `<div class="group-date">${label}</div>`;
            html += `<div class="results-group">`;
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
        container.innerHTML = html;
        container.style.display = 'block';
    } else {
        // Vista plana (cuadrícula)
        container.innerHTML = sorted.map(movie => `
            <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
                <img src="${movie.imageUrl}" alt="${movie.title}">
                <div class="info">
                    <h3>${escapeHtml(movie.title)}</h3>
                    <div class="channel">${escapeHtml(movie.channel)}</div>
                </div>
            </div>
        `).join('');
        container.style.display = 'grid';
    }
    
    // Actualizar título y botones de ordenamiento
    const sortId = `sortButtons-${container.id}`;
    if (container.id === 'fullSearchResults' && term) {
        const sortLabel = sortBy === 'date' ? 'by date' : (sortBy === 'title' ? 'by title' : 'by channel');
        const titleText = `Full Search Results: "${term}" (${sortLabel})`;
        const titleEl = document.querySelector('#fullSearchView .history-header h2');
        if (titleEl) titleEl.innerText = titleText;
        document.title = titleText;
    } else if (container.id === 'savedMoviesList') {
        const sortLabel = sortBy === 'date' ? 'by date' : (sortBy === 'title' ? 'by title' : 'by channel');
        const titleText = `Saved Free Movies (${sortLabel})`;
        const titleEl = document.getElementById('historyTitle');
        if (titleEl) titleEl.innerText = titleText;
        document.title = titleText;
    }
    
    statsContainer.innerHTML = `<strong>${sorted.length} movies</strong> · <span id="${sortId}">Sort by: <button data-sort="date">Date</button> | <button data-sort="title">Title</button> | <button data-sort="channel">Channel</button></span>`;
    
    const buttons = statsContainer.querySelectorAll(`#${sortId} button`);
    buttons.forEach(btn => {
        btn.onclick = () => {
            if (container.id === 'fullSearchResults') {
                renderMovies(movies, container, statsContainer, btn.dataset.sort, term);
                currentFullSort = btn.dataset.sort;
            } else if (container.id === 'savedMoviesList') {
                loadSavedMovies(btn.dataset.sort);
            }
        };
    });
}

function loadSavedMovies(sortBy = 'date') {
    const rawSearches = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
    let allMovies = [];
    rawSearches.forEach(entry => {
        entry.results.forEach(movie => {
            if (movie.channel === TARGET_CHANNEL) {
                allMovies.push(movie);
            }
        });
    });
    // Eliminar duplicados por id
    const uniqueMovies = [];
    const ids = new Set();
    allMovies.forEach(m => {
        if (!ids.has(m.id)) {
            ids.add(m.id);
            uniqueMovies.push(m);
        }
    });
    
    renderMovies(uniqueMovies, savedMoviesList, historyStats, sortBy, null);
}

searchBtn.onclick = async () => {
    const baseQuery = searchInput.value.trim();
    if (!baseQuery) return;
    
    currentSearchTerm = baseQuery;
    currentQuery = `${baseQuery} Películas Gratis YouTube Películas y TV de YouTube`;
    allResults = [];
    nextPageToken = null;
    resultsDiv.innerHTML = '';
    statsDiv.innerHTML = '';
    loadMoreBtn.style.display = 'none';
    
    searchView.style.display = 'block';
    historyView.style.display = 'none';
    fullSearchView.style.display = 'none';
    document.title = `Search: ${baseQuery}`;
    
    await loadResults();
    saveSearch(baseQuery);
    searchInput.value = '';
};

loadMoreBtn.onclick = async () => { await loadResults(); };

async function loadResults() {
    loadingDiv.style.display = 'block';
    try {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(currentQuery)}&key=${API_KEY}`;
        if (nextPageToken) url += `&pageToken=${nextPageToken}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items) {
            saveRawSearch(currentSearchTerm, data.items);
            const filtered = data.items.filter(video => video.snippet.channelTitle === TARGET_CHANNEL);
            allResults = [...allResults, ...filtered];
            displayResults();
            nextPageToken = data.nextPageToken || null;
            loadMoreBtn.style.display = nextPageToken ? 'block' : 'none';
        }
    } catch (error) {
        resultsDiv.innerHTML = `<div class="stats">Error: ${error.message}</div>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function displayResults() {
    if (allResults.length === 0 && !nextPageToken) {
        resultsDiv.innerHTML = `<div class="stats">😕 No results for "${currentSearchTerm}" in channel ${TARGET_CHANNEL}.</div>`;
        statsDiv.innerHTML = '';
        return;
    }
    
    resultsDiv.innerHTML = allResults.map(video => `
        <div class="video-card" onclick="window.open('https://youtube.com/watch?v=${video.id.videoId}')">
            <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
            <div class="info">
                <h3>${escapeHtml(video.snippet.title)}</h3>
                <div class="channel">${escapeHtml(video.snippet.channelTitle)}</div>
            </div>
        </div>
    `).join('');
    
    statsDiv.innerHTML = `<strong>🎥 ${allResults.length} results</strong> · Channel: ${TARGET_CHANNEL} · Search: "${currentSearchTerm}"`;
}

searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });

document.getElementById('clearStorageBtn').onclick = () => {
    if (confirm('Delete all "Saved Free Movies" and "Full Search Results"?')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(RAW_SEARCH_KEY);
        displayHistory();
        if (historyView.style.display === 'block') loadSavedMovies();
        if (fullSearchView.style.display === 'block') {
            fullSearchView.style.display = 'none';
            searchView.style.display = 'block';
        }
        alert('Datos borrados correctamente');
    }
};

displayHistory();