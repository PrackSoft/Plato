// js/modal.js
// Modal for movie details, term management, watching/favorite toggles, and trash actions

let currentMovie = null;
let currentOnUpdate = null;
let currentMovieSource = null; // 'main' or 'trash'
let currentTrashFunctions = null; // store trash functions for use in modal

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
    // Show delete button only for main movies; for trash, show restore and permanent delete buttons
    const deleteButtonHtml = isInTrash ? '' : `<span class="material-symbols-outlined modal-delete-btn" title="Move to trash">delete_forever</span>`;
    const trashActionsHtml = isInTrash ? `
        <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button id="restoreBtn" class="full-search-btn">Restore</button>
            <button id="permanentDeleteBtn" class="full-search-btn" style="background:#990000;">Delete Permanently</button>
        </div>
    ` : '';

    return `
        <div class="modal-header">
            ${deleteButtonHtml}
            <h2>${escapeHtml(movie.title)}</h2>
            <div style="width: 20px;"></div>
        </div>
        <img src="${movie.imageUrl}" style="width:100%; border-radius:8px; margin:10px 0;">
        <p><strong>YouTube Premiere:</strong> ${movie.publishedAt ? new Date(movie.publishedAt).toLocaleDateString() : 'Unknown'}</p>
        <div class="modal-description">${escapeHtml(movie.description || 'No Description')}</div>
        <p><strong>Duration:</strong> ${formatDuration(movie.duration)}</p>
        <p><strong>Saved on:</strong> ${new Date(movie.dateSaved).toLocaleString()}</p>
        ${isInTrash ? `<p><strong>Deleted on:</strong> ${movie.deletedAt ? new Date(movie.deletedAt).toLocaleString() : 'Unknown'}</p>` : ''}
        
        <!-- Terms management (readonly in trash) -->
        <div style="margin: 15px 0; background: #2a2a2a; padding: 10px; border-radius: 8px;">
            <strong>Search Terms:</strong>
            <div id="termsList" style="margin: 8px 0; display: flex; flex-wrap: wrap; gap: 6px;">
                ${(movie.searchTerms || []).map(term => `
                    <span class="term-chip">
                        ${escapeHtml(term)}
                        ${!isInTrash ? `<span class="remove-term" data-term="${escapeHtml(term)}" style="cursor:pointer; margin-left:6px;">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div style="display: flex; gap: 8px; margin-top: 8px;">
                <input type="text" id="newTermInput" placeholder="Add new term" style="flex:1; padding:6px; background:#1e1e1e; border:1px solid #444; color:white; border-radius:4px;">
                <button id="addTermBtn" class="full-search-btn" style="padding:6px 12px;">Add</button>
            </div>
            ` : ''}
        </div>

        <!-- Watching & Favorite toggles (disabled in trash) -->
        <div style="margin: 15px 0; padding: 10px; background: #2a2a2a; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Watching:</span>
                <label style="display: flex; align-items: center; gap: 8px; cursor: ${isInTrash ? 'default' : 'pointer'}; opacity: ${isInTrash ? 0.6 : 1};">
                    <span class="material-symbols-outlined">${movie.watching ? 'visibility' : 'visibility_off'}</span>
                    <input type="checkbox" id="modalWatchingCheckbox" ${movie.watching ? 'checked' : ''} ${isInTrash ? 'disabled' : ''}>
                </label>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Favorite:</span>
                <label style="display: flex; align-items: center; gap: 8px; cursor: ${isInTrash ? 'default' : 'pointer'}; opacity: ${isInTrash ? 0.6 : 1};">
                    <span class="material-symbols-outlined">${movie.favorite ? 'star' : 'star_outline'}</span>
                    <input type="checkbox" id="modalFavoriteCheckbox" ${movie.favorite ? 'checked' : ''} ${isInTrash ? 'disabled' : ''}>
                </label>
            </div>
        </div>
        ${trashActionsHtml}
    `;
}

async function attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source) {
    const isInTrash = (source === 'trash');

    // Delete button (move to trash) - only for main movies
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

    // Restore button (only in trash)
    const restoreBtn = document.getElementById('restoreBtn');
    if (restoreBtn && isInTrash) {
        restoreBtn.onclick = async () => {
            await restoreFromTrash(movie.youtubeId);
            closeModal();
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // Permanent delete button (only in trash)
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

    // Watching checkbox (disabled in trash)
    const watchingCheckbox = document.getElementById('modalWatchingCheckbox');
    if (watchingCheckbox && !isInTrash) {
        watchingCheckbox.onchange = async (e) => {
            const newStatus = await toggleWatching(movie.youtubeId);
            movie.watching = newStatus;
            const iconSpan = watchingCheckbox.parentElement.querySelector('.material-symbols-outlined');
            if (iconSpan) iconSpan.textContent = newStatus ? 'visibility' : 'visibility_off';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // Favorite checkbox (disabled in trash)
    const favoriteCheckbox = document.getElementById('modalFavoriteCheckbox');
    if (favoriteCheckbox && !isInTrash) {
        favoriteCheckbox.onchange = async (e) => {
            const newStatus = await toggleFavorite(movie.youtubeId);
            movie.favorite = newStatus;
            const iconSpan = favoriteCheckbox.parentElement.querySelector('.material-symbols-outlined');
            if (iconSpan) iconSpan.textContent = newStatus ? 'star' : 'star_outline';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    // Remove term (only in main)
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
                            <span class="remove-term" data-term="${escapeHtml(t)}" style="cursor:pointer; margin-left:6px;">✖</span>
                        </span>
                    `).join(''));
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // Add term (only in main)
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
                                <span class="remove-term" data-term="${escapeHtml(t)}" style="cursor:pointer; margin-left:6px;">✖</span>
                            </span>
                        `).join(''));
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
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