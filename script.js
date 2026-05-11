function renderMovies(movies, sortBy, titlePrefix, viewMode) {
    // Aplicar filtro de watching si está activo
    let filteredMovies = movies;
    if (watchingFilterActive) {
        filteredMovies = movies.filter(m => m.watching === true);
    }
    const sorted = sortMovies(filteredMovies, sortBy);
    const isDateSort = (sortBy === 'date');
    if (sorted.length === 0) {
        if (watchingFilterActive && movies.length > 0) {
            resultsGrid.innerHTML = '<p class="stats">No movies marked as watching in this view. Click the "Watching" button again to show all.</p>';
        } else {
            resultsGrid.innerHTML = '<p class="stats">No movies to display.</p>';
        }
        resultsStats.innerHTML = '';
        resultsTitle.innerText = titlePrefix;
        return;
    }
    if (isDateSort) {
        const groups = new Map();
        const todayKey = getLocalDateKey(new Date());
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = getLocalDateKey(yesterdayDate);
        sorted.forEach(movie => {
            const localKey = getLocalDateKey(movie.date);
            if (!groups.has(localKey)) groups.set(localKey, []);
            groups.get(localKey).push(movie);
        });
        const sortedGroups = Array.from(groups.entries()).sort((a,b) => new Date(b[0]) - new Date(a[0]));
        let html = '';
        for (const [dateKey, movieList] of sortedGroups) {
            let label;
            if (dateKey === todayKey) label = 'Today';
            else if (dateKey === yesterdayKey) label = 'Yesterday';
            else {
                const [year, month, day] = dateKey.split('-');
                const dateObj = new Date(year, month-1, day);
                label = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            html += `<div class="date-group"><div class="group-date">${label}</div><div class="results-group">`;
            html += movieList.map(movie => `
                <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")}, "${viewMode}")'>
                    <img src="${movie.imageUrl}" alt="${movie.title}">
                    <div class="info">
                        <h3>${escapeHtml(movie.title)}</h3>
                        <div class="channel">${escapeHtml(movie.channel)}</div>
                        <div class="card-stats" style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #aaa;">
                            <span class="comments"><span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">forum</span> ${formatNumber(movie.commentCount)}</span>
                            <span class="likes"><span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">thumb_up</span> ${formatNumber(movie.likeCount)}</span>
                            <span class="watching-icon" data-id="${movie.id}" data-term="${movie.searchTerm}" data-watching="${movie.watching}" style="cursor: pointer;">
                                <span class="material-symbols-outlined" style="font-size: 18px;">${movie.watching ? 'visibility' : 'visibility_off'}</span>
                            </span>
                        </div>
                    </div>
                </div>
            `).join('');
            html += `</div></div>`;
        }
        resultsGrid.innerHTML = html;
        resultsGrid.style.display = 'block';
    } else {
        resultsGrid.innerHTML = sorted.map(movie => `
            <div class="video-card" onclick='openModal(${JSON.stringify(movie).replace(/'/g, "&#39;")}, "${viewMode}")'>
                <img src="${movie.imageUrl}" alt="${movie.title}">
                <div class="info">
                    <h3>${escapeHtml(movie.title)}</h3>
                    <div class="channel">${escapeHtml(movie.channel)}</div>
                    <div class="card-stats" style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #aaa;">
                        <span class="comments"><span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">forum</span> ${formatNumber(movie.commentCount)}</span>
                        <span class="likes"><span class="material-symbols-outlined" style="font-size: 14px; vertical-align: middle;">thumb_up</span> ${formatNumber(movie.likeCount)}</span>
                        <span class="watching-icon" data-id="${movie.id}" data-term="${movie.searchTerm}" data-watching="${movie.watching}" style="cursor: pointer;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">${movie.watching ? 'visibility' : 'visibility_off'}</span>
                        </span>
                    </div>
                </div>
            </div>
        `).join('');
        resultsGrid.style.display = 'grid';
    }
    resultsTitle.innerText = titlePrefix;
    const sortLabel = sortBy === 'date' ? 'by date' : (sortBy === 'title' ? 'by title' : (sortBy === 'channel' ? 'by channel' : (sortBy === 'mostViewed' ? 'by views' : (sortBy === 'mostLiked' ? 'by likes' : 'by comments'))));
    resultsStats.innerHTML = `<strong>${sorted.length} movies</strong> · <span id="sortButtons">Sort by: <button data-sort="date">Date</button> | <button data-sort="title">Title</button> | <button data-sort="channel">Channel</button> | <button data-sort="mostViewed">Most Viewed</button> | <button data-sort="mostLiked">Most Liked</button> | <button data-sort="mostCommented">Most Commented</button></span>`;
    const buttons = resultsStats.querySelectorAll('#sortButtons button');
    buttons.forEach(btn => {
        btn.onclick = () => {
            currentSort = btn.dataset.sort;
            updateView();
        };
    });
    // Asignar eventos a los íconos de watching en las tarjetas
    document.querySelectorAll('.watching-icon').forEach(icon => {
        icon.onclick = (e) => {
            e.stopPropagation(); // Evitar que se abra el modal al hacer clic en el icono
            const movieId = icon.dataset.id;
            const term = icon.dataset.term;
            const current = icon.dataset.watching === 'true';
            toggleWatching(movieId, term, current);
        };
    });
}