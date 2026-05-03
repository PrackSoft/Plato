const API_KEY = 'AIzaSyARahMLz_4ASjG9wiCpaAL_tGblm67Qwj4';
const TARGET_CHANNEL = 'YouTube Movies';
const MAX_RESULTS_PER_PAGE = 50;

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwn-JhVgE_gzL1rXGRWAHvAq4b4v6vfV1aKD3Q9zHIKYsmG3jAg79fCYNnBDCSjfpEKDg/exec';

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
        historyDiv.innerHTML = '<div style="color:#aaa;font-size:14px">Sin búsquedas recientes</div>';
        return;
    }

    historyDiv.innerHTML =
        '<div style="color:#aaa;font-size:14px">Recientes:</div>' +
        historyItems.map(item =>
            `<button class="history-btn" data-term="${item.searchTerm}">${item.searchTerm}</button>`
        ).join('');

    document.querySelectorAll('.history-btn').forEach(btn => {
        btn.onclick = () => {
            searchInput.value = btn.dataset.term;
            searchBtn.click();
        };
    });
}

function displayResults(videos, searchTerm) {
    if (!videos || videos.length === 0) {
        resultsDiv.innerHTML = 'Sin resultados';
        return;
    }

    resultsDiv.innerHTML = videos.map(video => `
        <div class="video-card" onclick="window.open('${video.link}')">
            <img src="${video.thumbnail}">
            <div class="info">
                <h3>${escapeHtml(video.title)}</h3>
                <div class="channel">${escapeHtml(video.channel)}</div>
            </div>
        </div>
    `).join('');

    statsDiv.innerHTML = `${videos.length} resultados - ${searchTerm}`;
}

searchBtn.onclick = async () => {
    const baseQuery = searchInput.value.trim();
    if (!baseQuery) return;

    currentSearchTerm = baseQuery;
    currentQuery = `${baseQuery} YouTube Movies`;

    allResults = [];
    nextPageToken = null;

    await loadResults();
};

loadMoreBtn.onclick = () => loadResults();

async function loadResults() {
    loadingDiv.style.display = 'block';

    try {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(currentQuery)}&key=${API_KEY}`;

        if (nextPageToken) url += `&pageToken=${nextPageToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.items) {
            const filtered = data.items.filter(v =>
                v.snippet.channelTitle === TARGET_CHANNEL
            );

            allResults = [...allResults, ...filtered.map(v => ({
                title: v.snippet.title,
                link: `https://youtube.com/watch?v=${v.id.videoId}`,
                thumbnail: v.snippet.thumbnails.medium.url,
                channel: v.snippet.channelTitle
            }))];

            if (!nextPageToken) {
                await saveToSheet(currentSearchTerm, allResults);
            }

            displayResults(allResults, currentSearchTerm);

            nextPageToken = data.nextPageToken || null;
            loadMoreBtn.style.display = nextPageToken ? 'block' : 'none';
        }

    } catch (e) {
        resultsDiv.innerHTML = 'Error';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

async function saveToSheet(searchTerm, results) {
    try {
        await fetch(SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchTerm, results })
        });
    } catch (e) {}
}

function escapeHtml(str) {
    return (str || '').replace(/[&<>]/g, c =>
        c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'
    );
}

searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') searchBtn.click();
});

loadHistoryFromSheet();