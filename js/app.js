// js/app.js
import { openDB, saveMovie } from './db.js';
import { searchYouTube } from './api/youtube.js';

// Initialize database on load
await openDB();

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const outputDiv = document.getElementById('output');

searchBtn.onclick = async () => {
    const query = searchInput.value.trim();
    if (!query) {
        outputDiv.innerText = 'Please enter a search term.';
        return;
    }
    
    outputDiv.innerText = 'Searching...';
    try {
        const movies = await searchYouTube(query);
        if (movies.length === 0) {
            outputDiv.innerText = 'No movies found.';
            return;
        }
        
        // Save each movie with the current search term
        for (const movie of movies) {
            await saveMovie(movie, query);
        }
        
        outputDiv.innerText = `Saved ${movies.length} movies (or updated existing). Check console for details.`;
        console.log('Saved movies:', movies);
    } catch (err) {
        console.error(err);
        outputDiv.innerText = `Error: ${err.message}`;
    }
};