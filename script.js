const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;
const STORAGE_KEY = 'plato_search_history';
const SAVED_MOVIES_KEY = 'plato_saved_movies';

const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const statsDiv = document.getElementById('stats');
const historyDiv = document.getElementById('history');
const searchView = document.getElementById('searchView');
const historyView = document.getElementById('historyView');
const backToSearchBtn = document.getElementById('backToSearchBtn');
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
    let movies = JSON.parse(localStorage.getItem(SAVED_MOVIES_KEY) || '[]');
    const newMovies = movies.filter(m => m.id !== movieId);
    localStorage.setItem(SAVED_MOVIES_KEY, JSON.stringify(newMovies));
    if (historyView.style.display === 'block') loadSavedMovies();
}

function openModal(movie) {
    if (!modal) return;
    modalBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="delete-movie-btn" style="cursor: pointer; color: #ff0000; font-size: 20px;">🗑️</span>
            <h2>${escapeHtml(movie.title)}</h2>
        </div>
        <img src="${movie.imageUrl}" style="width:100%; border-radius:8px; margin:10px 0;">
        <p><strong>Premiere:</strong> ${movie.publishedAt ? new Date(movie.publishedAt).toLocaleDateString() : 'Unknown'}</p>
        <p><strong>Description:</strong></p>
        <div style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">${escapeHtml(movie.description || 'No Description')}</div>
        <p><strong>Search:</strong> ${new Date(movie.date).toLocaleString()}</p>
        <p><strong>Key Words:</strong> ${escapeHtml(movie.searchTerm)}</p>
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

function displayHistory() {
    if (!historyDiv) return;
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (history.length === 0) {
        historyDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">Sin búsquedas recientes</div>';
        return;
    }
    historyDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa; cursor: pointer;" id="historyIcon">🔍</div>' +
        history.map(term => `
            <button class="history-btn" data-term="${term}">
                ${term}
                <span class="history-delete" data-term="${term}">✖</span>
            </button>
        `).join('');
    
    document.querySelectorAll('.history-btn').forEach(btn => {
        btn.onclick = () => {
            searchInput.value = btn.dataset.term;
            searchView.style.display = 'block';
            historyView.style.display = 'none';
            searchBtn.click();
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
        };
    }
}

function saveMoviesFromSearch(searchTerm, movies) {
    const saved = JSON.parse(localStorage.getItem(SAVED_MOVIES_KEY) || '[]');
    const existingIds = new Set(saved.map(m => m.id));
    const newMovies = movies
        .filter(m => !existingIds.has(m.id.videoId))
        .map(m => ({
            id: m.id.videoId,
            title: m.snippet.title,
            channel: m.snippet.channelTitle,
            imageUrl: m.snippet.thumbnails.medium.url,
            url: `https://youtube.com/watch?v=${m.id.videoId}`,
            searchTerm: searchTerm,
            date: new Date().toISOString(),
            description: m.snippet.description,
            publishedAt: m.snippet.publishedAt
        }));
    if (newMovies.length === 0) return;
    const updated = [...newMovies, ...saved];
    localStorage.setItem(SAVED_MOVIES_KEY, JSON.stringify(updated.slice(0, 200)));
}

function loadSavedMovies(sortBy = 'date') {
    let movies = JSON.parse(localStorage.getItem(SAVED_MOVIES_KEY) || '[]');
    if (sortBy === 'title') movies.sort((a,b) => a.title.localeCompare(b.title));
    else if (sortBy === 'channel') movies.sort((a,b) => a.channel.localeCompare(b.channel));
    else movies.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if (movies.length === 0) {
        savedMoviesList.innerHTML = '<p class="stats">No saved movies yet.</p>';
        historyStats.innerHTML = '';
        return;
    }
    savedMoviesList.innerHTML = movies.map(movie => `
        <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")})'>
            <img src="${movie.imageUrl}" alt="${movie.title}">
            <div class="info">
                <h3>${escapeHtml(movie.title)}</h3>
                <div class="channel">${escapeHtml(movie.channel)}</div>
            </div>
        </div>
    `).join('');
    historyStats.innerHTML = `<strong>${movies.length} movies saved</strong> · <span id="sortButtons">Sort by: <button data-sort="date">Date</button> | <button data-sort="title">Title</button> | <button data-sort="channel">Channel</button></span>`;
    
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
    saveMoviesFromSearch(currentSearchTerm, allResults);
}

searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });

backToSearchBtn.onclick = () => {
    historyView.style.display = 'none';
    searchView.style.display = 'block';
};

document.getElementById('clearStorageBtn').onclick = () => {
    if (confirm('¿Borrar todo el historial y las películas guardadas?')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SAVED_MOVIES_KEY);
        displayHistory();
        if (historyView.style.display === 'block') loadSavedMovies();
        alert('Datos borrados correctamente');
    }
};

displayHistory();