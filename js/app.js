// js/app.js
import { openDB, getAllMovies } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';

let dbReady = openDB();

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');

// Load and display all saved movies on startup
async function loadAndDisplayAll() {
    await dbReady;
    const movies = await getAllMovies();
    renderMovies(resultsGrid, movies, 'All saved movies');
}

// Search and save, then refresh display
searchBtn.onclick = async () => {
    const query = searchInput.value.trim();
    if (!query) {
        resultsGrid.innerHTML = '<div class="stats">Enter a search term</div>';
        return;
    }
    resultsGrid.innerHTML = '<div class="stats">Searching...</div>';
    try {
        const moviesFromAPI = await searchYouTube(query);
        if (moviesFromAPI.length === 0) {
            resultsGrid.innerHTML = '<div class="stats">No movies found</div>';
            return;
        }
        const { saveMovie } = await import('./db.js');
        for (const movie of moviesFromAPI) {
            await saveMovie(movie, query);
        }
        // Reload display after saving
        await loadAndDisplayAll();
        searchInput.value = '';
    } catch (err) {
        console.error(err);
        resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
    }
};

// Initial load
loadAndDisplayAll();