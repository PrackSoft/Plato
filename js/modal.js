// js/modal.js
let currentMovie = null;
let currentOnUpdate = null;
let currentMovieSource = null;
let currentTrashFunctions = null;

export function initModal(onUpdateCallback) {
    currentOnUpdate = onUpdateCallback;
    const modal = document.getElementById('movieModal');
    const closeBtn = document.querySelector('.close-modal');
    const watchBtn = document.getElementById('watchMovieBtn');

    if (closeBtn) closeBtn.onclick = () => closeModal();
    if (watchBtn) watchBtn.onclick = () => {
        if (currentMovie && currentMovie.url) window.open(currentMovie.url);
    };
    window.onclick = (e) => { if (e.target === modal) closeModal(); };
}

export async function openModal(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source = 'main') {
    currentMovie = movie;
    currentMovieSource = source;
    currentTrashFunctions = { moveToTrash, restoreFromTrash, permanentlyDelete };
    const modal = document.getElementById('movieModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = renderModalContent(movie, source);
    modal.style.display = 'flex';

    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
}

function closeModal() {
    const modal = document.getElementById('movieModal');
    if (modal) modal.style.display = 'none';
    currentMovie = null;
    currentMovieSource = null;
    currentTrashFunctions = null;
}

function renderModalContent(movie, source) {
    const isInTrash = (source === 'trash');
    const deleteButtonHtml = isInTrash ? '' : `<span class="material-symbols-outlined modal-delete-btn" title="Move to trash">delete_forever</span>`;
    const trashActionsHtml = isInTrash ? `
        <div class="modal-trash-actions">
            <button id="restoreBtn" class="btn btn-secondary">Restore</button>
            <button id="permanentDeleteBtn" class="btn btn-danger">Delete Permanently</button>
        </div>
    ` : '';

    const watchingIconName = movie.watching ? 'visibility' : 'visibility_off';
    const favoriteIconName = movie.favorite ? 'star_shine' : 'star';

    return `
        <div class="modal-header">
            ${deleteButtonHtml}
            <h2>${escapeHtml(movie.title)}</h2>
            <div class="modal-spacer"></div>
        </div>
        <img class="modal-image" src="${movie.imageUrl}" alt="${movie.title}">
        <p><strong>YouTube Premiere:</strong> ${movie.publishedAt ? new Date(movie.publishedAt).toLocaleDateString() : 'Unknown'}</p>
        <div class="modal-description">${escapeHtml(movie.description || 'No Description')}</div>
        <p><strong>Duration:</strong> ${formatDuration(movie.duration)}</p>
        <p><strong>Saved on:</strong> ${new Date(movie.dateSaved).toLocaleString()}</p>
        ${isInTrash ? `<p><strong>Deleted on:</strong> ${movie.deletedAt ? new Date(movie.deletedAt).toLocaleString() : 'Unknown'}</p>` : ''}
        
        <div class="modal-section">
            <strong>Search Terms:</strong>
            <div id="termsList" class="terms-list">
                ${(movie.searchTerms || []).map(term => `
                    <span class="term-chip">
                        ${escapeHtml(term)}
                        ${!isInTrash ? `<span class="remove-term" data-term="${escapeHtml(term)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newTermInput" class="modal-input" placeholder="Add new term">
                <span id="addTermBtn" class="modal-add-icon" title="Add term">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- Watching toggle (ícono clickeable) -->
        <div class="modal-section toggle-row ${isInTrash ? 'disabled' : ''}" id="watchingToggleRow">
            <span>Watching:</span>
            <span class="material-symbols-outlined" id="modalWatchingIcon">${watchingIconName}</span>
        </div>

        <!-- Favorite toggle (ícono clickeable) -->
        <div class="modal-section toggle-row ${isInTrash ? 'disabled' : ''}" id="favoriteToggleRow">
            <span>Favorite:</span>
            <span class="material-symbols-outlined" id="modalFavoriteIcon">${favoriteIconName}</span>
        </div>

        ${trashActionsHtml}
    `;
}

async function attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source) {
    const isInTrash = (source === 'trash');

    const deleteBtn = document.querySelector('.modal-delete-btn');
    if (deleteBtn && !isInTrash) {
        deleteBtn.onclick = async () => {
            if (confirm('Move this movie to trash?')) {
                await moveToTrash(movie.youtubeId);
                closeModal();
                if (currentOnUpdate) await currentOnUpdate();
            }
        };
    }

    const restoreBtn = document.getElementById('restoreBtn');
    if (restoreBtn && isInTrash) {
        restoreBtn.onclick = async () => {
            await restoreFromTrash(movie.youtubeId);
            closeModal();
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    const permanentDeleteBtn = document.getElementById('permanentDeleteBtn');
    if (permanentDeleteBtn && isInTrash) {
        permanentDeleteBtn.onclick = async () => {
            if (confirm('Permanently delete this movie? This action cannot be undone.')) {
                await permanentlyDelete(movie.youtubeId);
                closeModal();
                if (currentOnUpdate) await currentOnUpdate();
            }
        };
    }

    // Watching toggle
    const watchingRow = document.getElementById('watchingToggleRow');
    if (watchingRow && !isInTrash) {
        const watchingIcon = document.getElementById('modalWatchingIcon');
        watchingRow.onclick = async () => {
            const newStatus = await toggleWatching(movie.youtubeId);
            movie.watching = newStatus;
            if (watchingIcon) watchingIcon.textContent = newStatus ? 'visibility' : 'visibility_off';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // Favorite toggle
    const favoriteRow = document.getElementById('favoriteToggleRow');
    if (favoriteRow && !isInTrash) {
        const favoriteIcon = document.getElementById('modalFavoriteIcon');
        favoriteRow.onclick = async () => {
            const newStatus = await toggleFavorite(movie.youtubeId);
            movie.favorite = newStatus;
            if (favoriteIcon) favoriteIcon.textContent = newStatus ? 'star_shine' : 'star';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // Remove term (x) inside chips
    if (!isInTrash) {
        document.querySelectorAll('.remove-term').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const term = el.dataset.term;
                const newTerms = movie.searchTerms.filter(t => t !== term);
                await updateMovieTerms(movie.youtubeId, newTerms);
                movie.searchTerms = newTerms;
                const termsContainer = document.getElementById('termsList');
                if (termsContainer) {
                    termsContainer.innerHTML = (newTerms.map(t => `
                        <span class="term-chip">
                            ${escapeHtml(t)}
                            <span class="remove-term" data-term="${escapeHtml(t)}">✖</span>
                        </span>
                    `).join(''));
                    // Re-attach events for new remove-term spans
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // Add term: icon click
    if (!isInTrash) {
        const addBtn = document.getElementById('addTermBtn');
        const newTermInput = document.getElementById('newTermInput');
        if (addBtn && newTermInput) {
            addBtn.onclick = async () => {
                const newTerm = newTermInput.value.trim();
                if (newTerm && !movie.searchTerms.includes(newTerm)) {
                    const newTerms = [...movie.searchTerms, newTerm];
                    await updateMovieTerms(movie.youtubeId, newTerms);
                    movie.searchTerms = newTerms;
                    newTermInput.value = '';
                    const termsContainer = document.getElementById('termsList');
                    if (termsContainer) {
                        termsContainer.innerHTML = (newTerms.map(t => `
                            <span class="term-chip">
                                ${escapeHtml(t)}
                                <span class="remove-term" data-term="${escapeHtml(t)}">✖</span>
                            </span>
                        `).join(''));
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            // Optional: press Enter in input triggers add
            newTermInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addBtn.click();
            });
        }
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function formatDuration(duration) {
    if (!duration || duration === 'N/A') return 'Unknown';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] ? match[1].slice(0,-1) : 0);
    const minutes = (match[2] ? match[2].slice(0,-1) : 0);
    const seconds = (match[3] ? match[3].slice(0,-1) : 0);
    return `${hours ? hours+':' : ''}${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
}