// js/app.js
//import { openDB, getAllMovies } from './db.js';
import { openDB, getAllMovies, saveMovie } from './db.js';

import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';

import { CHANNELS, getChannelName } from './channels.js';

let dbReady = openDB();

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');

const searchChannelSelect = document.getElementById('searchChannelSelect');
const displayFilterDiv = document.getElementById('displayFilterCheckboxes');

let currentDisplayChannelIds = []; // array of selected channel IDs for filtering

// Populate search channel dropdown
CHANNELS.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel.id === null ? '' : channel.id;
    option.textContent = channel.name;
    searchChannelSelect.appendChild(option);
});

// Populate display filter checkboxes
function buildDisplayFilter() {
    displayFilterDiv.innerHTML = '';
    CHANNELS.forEach(channel => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = channel.id === null ? '' : channel.id;
        checkbox.checked = (channel.id === 'UCuVPpxrm2VAgpH3Ktln4HXg'); // default: free movies channel selected
        checkbox.addEventListener('change', () => {
            updateDisplayFilter();
            loadAndDisplayAll();
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(channel.name));
        displayFilterDiv.appendChild(label);
        displayFilterDiv.appendChild(document.createTextNode(' '));
    });
}

function updateDisplayFilter() {
    const checkboxes = displayFilterDiv.querySelectorAll('input[type="checkbox"]');
    currentDisplayChannelIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value === '' ? null : cb.value);
}

// Load and display movies filtered by selected display channels
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies = await getAllMovies();
    // Filter by selected display channels
    if (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) {
        // Show only movies whose channelId is in the selected list
        allMovies = allMovies.filter(movie => currentDisplayChannelIds.includes(movie.channelId));
    } else if (currentDisplayChannelIds.includes(null)) {
        // "All channels" selected: show everything, no filtering
        // (do nothing)
    } else {
        // No filter selected? Show nothing? We'll treat as "no filter" but let's be safe: show all
        // Actually if no checkboxes are checked, we could show empty, but for UX we'll show all.
    }
    renderMovies(resultsGrid, allMovies, `Movies (${allMovies.length})`);
}

// Search and save
searchBtn.onclick = async () => {
    const query = searchInput.value.trim();
    if (!query) {
        resultsGrid.innerHTML = '<div class="stats">Enter a search term</div>';
        return;
    }
    const searchChannelId = searchChannelSelect.value === '' ? null : searchChannelSelect.value;
    resultsGrid.innerHTML = '<div class="stats">Searching...</div>';
    try {
        const moviesFromAPI = await searchYouTube(query, searchChannelId);
        if (moviesFromAPI.length === 0) {
            resultsGrid.innerHTML = '<div class="stats">No movies found</div>';
            return;
        }
        for (const movie of moviesFromAPI) {
            await saveMovie(movie, query);
        }
        await loadAndDisplayAll();
        searchInput.value = '';
    } catch (err) {
        console.error(err);
        resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
    }
};

// Initial load
buildDisplayFilter();
updateDisplayFilter();
loadAndDisplayAll();