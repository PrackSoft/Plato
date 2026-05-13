// js/render.js
export function renderMovies(container, movies, title) {
    if (!movies.length) {
        container.innerHTML = `<div class="stats">No movies saved yet.</div>`;
        return;
    }
    const html = `
        <div class="history-header">
            <h2>${title} (${movies.length})</h2>
        </div>
        <div class="movies-grid">
            ${movies.map(movie => `
                <div class="video-card" data-id="${movie.youtubeId}">
                    <img src="${movie.imageUrl}" alt="${movie.title}">
                    <div class="info">
                        <h3>${escapeHtml(movie.title)}</h3>
                        <div class="channel">${escapeHtml(movie.channelTitle)}</div>
                        <div class="terms">Terms: ${(movie.searchTerms || []).join(', ')}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    container.innerHTML = html;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}