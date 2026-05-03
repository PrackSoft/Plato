// script.js - agregar funciones para modal
const modal = document.getElementById('movieModal');
const closeModal = document.querySelector('.close-modal');
const modalBody = document.getElementById('modalBody');
const watchBtn = document.getElementById('watchMovieBtn');
let currentMovieUrl = '';

function openModal(movie) {
    modalBody.innerHTML = `
        <h2>${escapeHtml(movie.title)}</h2>
        <p><strong>Canal:</strong> ${escapeHtml(movie.channel)}</p>
        <p><strong>Fecha:</strong> ${new Date(movie.publishedAt).toLocaleDateString()}</p>
        <p><strong>Descripción:</strong> ${escapeHtml(movie.description)}</p>
    `;
    currentMovieUrl = movie.url;
    modal.style.display = 'flex';
}
closeModal.onclick = () => modal.style.display = 'none';
watchBtn.onclick = () => window.open(currentMovieUrl);
window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

// Modificar loadSavedMovies para que cada card llame a openModal
savedMoviesList.innerHTML = movies.map(movie => `
    <div class="video-card" onclick="openModal(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
        <img src="${movie.imageUrl}" alt="${movie.title}">
        <div class="info">
            <h3>${escapeHtml(movie.title)}</h3>
            <div class="channel">${escapeHtml(movie.channel)}</div>
        </div>
    </div>
`).join('');

// Actualizar saveMoviesFromSearch para guardar description y publishedAt
const newMovies = movies
    .filter(m => !existingIds.has(m.id.videoId))
    .map(m => ({
        id: m.id.videoId,
        title: m.snippet.title,
        channel: m.snippet.channelTitle,
        imageUrl: m.snippet.thumbnails.medium.url,
        url: `https://youtube.com/watch?v=${m.id.videoId}`,
        searchTerm: searchTerm,
        date: new Date().toISOString(),
        description: m.snippet.description,
        publishedAt: m.snippet.publishedAt
    }));