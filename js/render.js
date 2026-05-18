// js/render.js
import { toggleWatching } from './db.js';

function formatNumber(num) {
    if (num === undefined || num === null || num === 'N/A') return 'N/A';
    let n = parseInt(num, 10);
    if (isNaN(n)) return num;
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function getLocalDateKey(utcDateString) {
    const date = new Date(utcDateString);
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
}

export function renderMovies(container, movies, title, source = 'main', currentSort = 'date', onSortChange = null) {
    if (!movies.length) {
        container.innerHTML = `<div class="stats">No movies ${source === 'trash' ? 'in trash' : 'saved yet'}.</div>`;
        return;
    }

    const sorted = sortMovies(movies, currentSort);
    const isDateSort = (currentSort === 'date');

    const sortOptions = [
        { value: 'date', label: 'Date' },
        { value: 'title', label: 'Title' },
        { value: 'channel', label: 'Channel' },
        { value: 'mostViewed', label: 'Most Viewed' },
        { value: 'mostLiked', label: 'Most Liked' },
        { value: 'mostCommented', label: 'Most Commented' },
        { value: 'watching', label: 'Watching' },
        { value: 'favorite', label: 'Favorites' }
    ];
    const sortSelectHtml = `
        <div class="sort-control">
            <label>Sort by:</label>
            <select id="sortSelect">
                ${sortOptions.map(opt => `<option value="${opt.value}" ${currentSort === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
        </div>
    `;

    function generateCard(movie) {
        return `
            <div class="video-card" data-id="${movie.youtubeId}">
                <img src="${movie.imageUrl}" alt="${movie.title}">
                <div class="info">
                    <h3>${escapeHtml(movie.title)}</h3>
                    <div class="channel">${escapeHtml(movie.channelTitle)}</div>
                    <div class="card-stats">
                        <span class="comments">
                            <span class="material-symbols-outlined stat-icon">forum</span>
                            ${formatNumber(movie.commentCount)}
                        </span>
                        <span class="likes">
                            <span class="material-symbols-outlined stat-icon">thumb_up</span>
                            ${formatNumber(movie.likeCount)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    let bodyHtml = '';
    if (isDateSort) {
        const todayKey = getLocalDateKey(new Date().toISOString());
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = getLocalDateKey(yesterdayDate.toISOString());
        const groups = new Map();
        sorted.forEach(movie => {
            const key = getLocalDateKey(movie.dateSaved);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(movie);
        });
        const sortedGroups = Array.from(groups.entries()).sort((a, b) => new Date(b[0]) - new Date(a[0]));
        bodyHtml = sortedGroups.map(([dateKey, movieList]) => {
            let label;
            if (dateKey === todayKey) label = 'Today';
            else if (dateKey === yesterdayKey) label = 'Yesterday';
            else {
                const [year, month, day] = dateKey.split('-');
                const dateObj = new Date(year, month - 1, day);
                label = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            return `
                <div class="date-group">
                    <div class="group-date">${label}</div>
                    <div class="results-group">
                        ${movieList.map(m => generateCard(m)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        bodyHtml = `<div class="movies-grid">${sorted.map(m => generateCard(m)).join('')}</div>`;
    }

    container.innerHTML = `
        <div class="history-header">
            <h2>${escapeHtml(title)}</h2>
            ${sortSelectHtml}
        </div>
        ${bodyHtml}
    `;

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect && onSortChange) {
        sortSelect.addEventListener('change', (e) => {
            onSortChange(e.target.value);
        });
    }

    // No more watching-icon handlers on cards
    // The watching filter and modal toggle remain functional

    document.querySelectorAll('.video-card').forEach(card => {
        const movieId = card.dataset.id;
        const movie = movies.find(m => m.youtubeId === movieId);
        if (movie && window.openMovieModal) {
            card.onclick = () => {
                window.openMovieModal(movie, source);
            };
        }
    });
}

function sortMovies(movies, sortBy) {
    const sorted = [...movies];
    switch (sortBy) {
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'channel':
            sorted.sort((a, b) => a.channelTitle.localeCompare(b.channelTitle));
            break;
        case 'mostViewed':
            sorted.sort((a, b) => (parseInt(b.viewCount) || 0) - (parseInt(a.viewCount) || 0));
            break;
        case 'mostLiked':
            sorted.sort((a, b) => (parseInt(b.likeCount) || 0) - (parseInt(a.likeCount) || 0));
            break;
        case 'mostCommented':
            sorted.sort((a, b) => (parseInt(b.commentCount) || 0) - (parseInt(a.commentCount) || 0));
            break;
        case 'watching':
            sorted.sort((a, b) => (b.watching ? 1 : 0) - (a.watching ? 1 : 0));
            break;
        case 'favorite':
            sorted.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
            break;
        default:
            sorted.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
    }
    return sorted;
}