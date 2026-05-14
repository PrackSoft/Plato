// js/render.js
import { toggleWatching } from './db.js';

// Helper to format numbers (e.g., 1200 -> 1.2K)
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

export function renderMovies(container, movies, title) {
    if (!movies.length) {
        container.innerHTML = `<div class="stats">No movies saved yet.</div>`;
        return;
    }

    const html = `
        <div class="history-header">
            <h2>${escapeHtml(title)} (${movies.length})</h2>
        </div>
        <div class="movies-grid">
            ${movies.map(movie => `
                <div class="video-card" data-id="${movie.youtubeId}">
                    <img src="${movie.imageUrl}" alt="${movie.title}">
                    <div class="info">
                        <h3>${escapeHtml(movie.title)}</h3>
                        <div class="channel">${escapeHtml(movie.channelTitle)}</div>
                        <div class="card-stats" style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #aaa;">
                            <span class="comments">
                                <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">forum</span>
                                ${formatNumber(movie.commentCount)}
                            </span>
                            <span class="likes">
                                <span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">thumb_up</span>
                                ${formatNumber(movie.likeCount)}
                            </span>
                            <span class="watching-icon" data-id="${movie.youtubeId}" data-watching="${movie.watching}" style="cursor: pointer;">
                                <span class="material-symbols-outlined" style="font-size: 18px;">${movie.watching ? 'visibility' : 'visibility_off'}</span>
                            </span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    container.innerHTML = html;

    // Attach click handlers to watching icons
    document.querySelectorAll('.watching-icon').forEach(icon => {
        const movieId = icon.dataset.id;
        const watchingSpan = icon.querySelector('.material-symbols-outlined');
        icon.onclick = async (e) => {
            e.stopPropagation();
            const newStatus = await toggleWatching(movieId);
            // Update icon
            watchingSpan.textContent = newStatus ? 'visibility' : 'visibility_off';
            // Update dataset
            icon.dataset.watching = newStatus;
            // Dispatch a custom event to notify app that watching status changed
            window.dispatchEvent(new CustomEvent('watching-toggled', { detail: { movieId, watching: newStatus } }));
        };
    });
}