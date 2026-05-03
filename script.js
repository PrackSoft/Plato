// const TARGET_CHANNEL = 'YouTube Movies'; // OLD: filter by channel name
const TARGET_CHANNEL_ID = 'UClgRkhTL3_hImCAmLdDE4Q'; // NEW: filter by channel ID

const MAX_RESULTS_PER_PAGE = 50;
const STORAGE_KEY = 'plato_search_history';

const searchBtn = document.getElementById('searchBtn');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const statsDiv = document.getElementById('stats');
const historyDiv = document.getElementById('history');

let nextPageToken = null;
let currentQuery = '';
let allResults = [];
let currentSearchTerm = '';

function saveSearch(term) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history = [term, ...history.filter(t => t !== term)].slice(0, 10);
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
    historyDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">🔍 Recientes:</div>' +
        history.map(term => `<button class="history-btn" data-term="${term}">${term}</button>`).join('');
    
    document.querySelectorAll('.history-btn').forEach(btn => {
        btn.onclick = () => {
            searchInput.value = btn.dataset.term;
            searchBtn.click();
        };
    });
}

searchBtn.onclick = async () => {
    const baseQuery = searchInput.value.trim();
    if (!baseQuery) return;
    
    currentSearchTerm = baseQuery;
    currentQuery = `${baseQuery} YouTube Movies`;
    
    allResults = [];
    nextPageToken = null;
    resultsDiv.innerHTML = '';
    statsDiv.innerHTML = '';
    loadMoreBtn.style.display = 'none';
    
    await loadResults();
    saveSearch(baseQuery);
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
            // OLD: filter by channelTitle === TARGET_CHANNEL
            // const filtered = data.items.filter(video => video.snippet.channelTitle === TARGET_CHANNEL);
            // NEW: filter by channelId
            const filtered = data.items.filter(video => video.snippet.channelId === TARGET_CHANNEL_ID);
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
        resultsDiv.innerHTML = `<div class="stats">😕 No results for "${currentSearchTerm}" in channel ${TARGET_CHANNEL_ID}.</div>`;
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
    
    statsDiv.innerHTML = `<strong>🎥 ${allResults.length} results</strong> · Channel ID: ${TARGET_CHANNEL_ID} · Search: "${currentSearchTerm}"`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });

displayHistory();
