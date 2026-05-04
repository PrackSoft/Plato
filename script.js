// script.js - Unified storage: only raw search results, filtered views derive from it
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;
const STORAGE_KEY = 'plato_search_history';     // List of search terms
const RAW_SEARCH_KEY = 'plato_raw_searches';     // Complete API results per term

const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const statsDiv = document.getElementById('stats');

const fullSearchDiv = document.getElementById('fullSearch');        // Container for tags
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
    if (searchView.style.display === 'block') {
        // No need to reload search results (they come from live API)
    }
}

function openModal(movie) {
    if (!modal) return;
    modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="delete-movie-btn" style="cursor: pointer; color: #ff0000; font-size: 20px;">🗑️</span>
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
    const newEntry = {
        searchTerm: searchTerm,
        date: new Date().toISOString(),
        results: rawItems.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            imageUrl: item.snippet.thumbnails.medium.url,
            url: `https://youtube.com/watch?v=${item.id.videoId}`,
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            searchTerm: searchTerm,
            date: new Date().toISOString()
        }))
    };
    const index = rawSearches.findIndex(entry => entry.searchTerm === searchTerm);
    if (index !== -1) rawSearches[index] = newEntry;
    else rawSearches.unshift(newEntry);
    rawSearches = rawSearches.slice(0, 20);
    localStorage.setItem(RAW_SEARCH_KEY, JSON.stringify(rawSearches));
}

function displayHistory() {
    if (!fullSearchDiv) return;
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (history.length === 0) {
        fullSearchDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">Sin búsquedas recientes</div>';
        return;
    }
    // Cambiar el icono: usar un Google Icon (Material Icon)
    fullSearchDiv.innerHTML = '<button class="fullsearch-btn material-symbols-outlined" id="historyIcon">filter_alt</button>' +
        history.map(term => `
            <button class="fullsearch-btn" data-term="${term}">
                ${term}
                <span class="history-delete" data-term="${term}">✖</span>
            </button>
        `).join('');
    
    document.querySelectorAll('.fullsearch-btn').forEach(btn => {
        // Saltamos el botón #historyIcon que no tiene data-term
        if (!btn.dataset.term) return;
        btn.onclick = () => {
            const term = btn.dataset.term;
            const rawData = JSON.parse(localStorage.getItem(RAW_SEARCH_KEY) || '[]');
            const search = rawData.find(item => item.searchTerm === term);
            if (search && search.results.length) {
                fullSearchResults.innerHTML = search.results.map(movie => `
                    <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
                        <img src="${movie.imageUrl}" alt="${movie.title}">
                        <div class="info">
                            <h3>${escapeHtml(movie.title)}</h3>
                            <div class="channel">${escapeHtml(movie.channel)}</div>
                        </div>
                    </div>
                `).join('');
                fullSearchStats.innerHTML = `<strong>${search.results.length} resultados</strong> para "${term}" (sin filtro)`;
                searchView.style.display = 'none';
                historyView.style.display = 'none';
                fullSearchView.style.display = 'block';
            } else {
                alert('No hay resultados guardados para este término. Realiza una búsqueda primero.');
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
    const uniqueMovies = [];
    const ids = new Set();
    allMovies.forEach(m => {
        if (!ids.has(m.id)) {
            ids.add(m.id);
            uniqueMovies.push(m);
        }
    });
    
    if (sortBy === 'title') uniqueMovies.sort((a,b) => a.title.localeCompare(b.title));
    else if (sortBy === 'channel') uniqueMovies.sort((a,b) => a.channel.localeCompare(b.channel));
    else uniqueMovies.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if (uniqueMovies.length === 0) {
        savedMoviesList.innerHTML = '<p class="stats">No saved movies yet (filtered by ' + TARGET_CHANNEL + ').</p>';
        historyStats.innerHTML = '';
        return;
    }
    savedMoviesList.innerHTML = uniqueMovies.map(movie => `
        <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
            <img src="${movie.imageUrl}" alt="${movie.title}">
            <div class="info">
                <h3>${escapeHtml(movie.title)}</h3>
                <div class="channel">${escapeHtml(movie.channel)}</div>
            </div>
        </div>
    `).join('');
    historyStats.innerHTML = `<strong>${uniqueMovies.length} movies saved</strong> (filtered by channel ${TARGET_CHANNEL}) · <span id="sortButtons">Sort by: <button data-sort="date">Date</button> | <button data-sort="title">Title</button> | <button data-sort="channel">Channel</button></span>`;
    
    document.querySelectorAll('#sortButtons button').forEach(btn => {
        btn.onclick = () => loadSavedMovies(btn.dataset.sort);
    });
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
    if (confirm('¿Borrar todo el historial y las películas guardadas?')) {
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