// script.js (igual que antes, sin cambios)
const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;

const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const statsDiv = document.getElementById('stats');

let nextPageToken = null;
let currentQuery = '';
let allResults = [];
let currentSearchTerm = '';

searchBtn.onclick = async () => {
    const baseQuery = searchInput.value.trim();
    if (!baseQuery) return;
    
    currentSearchTerm = baseQuery;
    currentQuery = `${baseQuery} YouTube Movies Películas Gratis YouTube`;
    
    allResults = [];
    nextPageToken = null;
    resultsDiv.innerHTML = '';
    statsDiv.innerHTML = '';
    loadMoreBtn.style.display = 'none';
    
    await loadResults();
};

loadMoreBtn.onclick = async () => {
    await loadResults();
};

async function loadResults() {
    loadingDiv.style.display = 'block';
    
    try {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(currentQuery)}&key=${API_KEY}`;
        if (nextPageToken) {
            url += `&pageToken=${nextPageToken}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items) {
            const filtered = data.items.filter(video => 
                video.snippet.channelTitle === TARGET_CHANNEL
            );
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
        resultsDiv.innerHTML = `<div class="stats">😕 No se encontraron videos del canal "${TARGET_CHANNEL}" para "${currentSearchTerm}". Probá con otras palabras.</div>`;
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
    
    statsDiv.innerHTML = `<strong>🎥 ${allResults.length} resultados</strong> · Canal: ${TARGET_CHANNEL} · Búsqueda: "${currentSearchTerm}"`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});