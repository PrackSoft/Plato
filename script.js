const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyK8ors7OYqcNBrecs9xP-dCqvZhfuAgSfh6O8_Q9iH11Gmd5fJ5NgSTKa5vk5mQz83Eg/exec';

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

async function loadHistoryFromSheet() {
    try {
        const response = await fetch(SHEET_URL);
        const data = await response.json();
        if (data && data.history) {
            displayHistory(data.history);
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function displayHistory(historyItems) {
    if (!historyDiv) return;
    if (!historyItems || historyItems.length === 0) {
        historyDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">Sin búsquedas recientes</div>';
        return;
    }
    historyDiv.innerHTML = '<div style="margin: 10px 0; font-size: 14px; color: #aaa;">🔍 Recientes:</div>' +
        historyItems.map(item => `<button class="history-btn" data-term="${item.searchTerm}">${item.searchTerm}</button>`).join('');
    
    document.querySelectorAll('.history-btn').forEach(btn => {
        btn.onclick = () => {
            const term = btn.dataset.term;
            const savedResults = historyItems.find(item => item.searchTerm === term);
            if (savedResults && savedResults.results) {
                displayResults(savedResults.results, term);
            } else {
                searchInput.value = term;
                searchBtn.click();
            }
        };
    });
}

function displayResults(videos, searchTerm) {
    if (!videos || videos.length === 0) {
        resultsDiv.innerHTML = `<div class="stats">😕 No hay resultados guardados para "${searchTerm}".</div>`;
        statsDiv.innerHTML = '';
        return;
    }
    
    resultsDiv.innerHTML = videos.map(video => `
        <div class="video-card" onclick="window.open('${video.link}')">
            <img src="${video.thumbnail}" alt="${video.title}">
            <div class="info">
                <h3>${escapeHtml(video.title)}</h3>
                <div class="channel">${escapeHtml(video.channel)}</div>
            </div>
        </div>
    `).join('');
    
    statsDiv.innerHTML = `<strong>🎥 ${videos.length} resultados</strong> · Búsqueda: "${searchTerm}" (desde Google Sheets)`;
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
            
            if (!nextPageToken) {
                await saveToSheet(currentSearchTerm, allResults);
            }
            
            displayResults(formatResults(allResults), currentSearchTerm);
            nextPageToken = data.nextPageToken || null;
            loadMoreBtn.style.display = nextPageToken ? 'block' : 'none';
        }
    } catch (error) {
        resultsDiv.innerHTML = `<div class="stats">Error: ${error.message}</div>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function formatResults(videos) {
    return videos.map(video => ({
        title: video.snippet.title,
        link: `https://youtube.com/watch?v=${video.id.videoId}`,
        thumbnail: video.snippet.thumbnails.medium.url,
        channel: video.snippet.channelTitle
    }));
}

async function saveToSheet(searchTerm, videos) {
    const data = {
        searchTerm: searchTerm,
        results: formatResults(videos)
    };
    
    try {
        await fetch(SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error('Error saving to sheet:', e);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });

loadHistoryFromSheet();