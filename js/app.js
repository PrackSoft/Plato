// ==========================================
// js/app.js - Main application logic
// ==========================================

// ------------------------------------------
// 1. IMPORTS
// ------------------------------------------
import { openDB, getAllMovies, saveMovie } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';
import { CHANNELS } from './channels.js';

// ------------------------------------------
// 2. DOM ELEMENTS
// ------------------------------------------
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');

// Dropdown: Search In (single selection)
const searchInBtn = document.getElementById('searchInBtn');
const searchInPanel = document.getElementById('searchInPanel');

// Dropdown: Show Channels (multi selection)
const showChannelsBtn = document.getElementById('showChannelsBtn');
const showChannelsPanel = document.getElementById('showChannelsPanel');

// ------------------------------------------
// 3. GLOBAL STATE
// ------------------------------------------
let dbReady = openDB();               // Promise for IndexedDB
let currentSearchChannelId = null;   // null = All Channels
let currentDisplayChannelIds = [];    // array of channel IDs (null = All Channels)

// ------------------------------------------
// 4. SEARCH IN PANEL (single selection with radio buttons)
// ------------------------------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    // Option: All Channels
    const allLabel = document.createElement('label');
    const allRadio = document.createElement('input');
    allRadio.type = 'radio';
    allRadio.name = 'searchChannel';
    allRadio.value = '';
    allRadio.checked = (currentSearchChannelId === null);
    allRadio.addEventListener('change', () => {
        if (allRadio.checked) {
            currentSearchChannelId = null;
            searchInPanel.classList.add('hidden'); // close panel after selection
        }
    });
    allLabel.appendChild(allRadio);
    allLabel.appendChild(document.createTextNode('All Channels'));
    searchInPanel.appendChild(allLabel);

    // Options for each real channel (skip those with id === null)
    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'searchChannel';
        radio.value = channel.id;
        radio.checked = (currentSearchChannelId === channel.id);
        radio.addEventListener('change', () => {
            if (radio.checked) {
                currentSearchChannelId = channel.id;
                searchInPanel.classList.add('hidden'); // close panel after selection
            }
        });
        label.appendChild(radio);
        label.appendChild(document.createTextNode(channel.name));
        searchInPanel.appendChild(label);
    });
}

// Toggle Search In panel and close the other panel
searchInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchInPanel.classList.toggle('hidden');
    showChannelsPanel.classList.add('hidden');
});

// ------------------------------------------
// 5. SHOW CHANNELS PANEL (multi selection with checkboxes)
// ------------------------------------------
function buildShowChannelsPanel() {
    showChannelsPanel.innerHTML = '';

    // Option: All Channels (checkbox)
    const allLabel = document.createElement('label');
    const allCheckbox = document.createElement('input');
    allCheckbox.type = 'checkbox';
    allCheckbox.value = '';
    allCheckbox.checked = currentDisplayChannelIds.includes(null);
    allCheckbox.addEventListener('change', () => {
        if (allCheckbox.checked) {
            // If "All Channels" is checked, uncheck all others and set state to [null]
            currentDisplayChannelIds = [null];
            updateShowChannelsCheckboxes();
        } else {
            // Remove null from array
            currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
        }
        loadAndDisplayAll(); // refresh movie list
    });
    allLabel.appendChild(allCheckbox);
    allLabel.appendChild(document.createTextNode('All Channels'));
    showChannelsPanel.appendChild(allLabel);

    // Options for each real channel
    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = channel.id;
        checkbox.checked = currentDisplayChannelIds.includes(channel.id);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                // If adding a specific channel, remove "All Channels" if present
                if (currentDisplayChannelIds.includes(null)) {
                    currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
                    updateShowChannelsCheckboxes();
                }
                if (!currentDisplayChannelIds.includes(channel.id)) {
                    currentDisplayChannelIds.push(channel.id);
                }
            } else {
                currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== channel.id);
            }
            loadAndDisplayAll(); // refresh movie list
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(channel.name));
        showChannelsPanel.appendChild(label);
    });
}

// Sync checkbox UI with currentDisplayChannelIds
function updateShowChannelsCheckboxes() {
    const checkboxes = showChannelsPanel.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const val = cb.value === '' ? null : cb.value;
        cb.checked = currentDisplayChannelIds.includes(val);
    });
}

// Toggle Show Channels panel and close the other panel
showChannelsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showChannelsPanel.classList.toggle('hidden');
    searchInPanel.classList.add('hidden');
});

// Close both panels when clicking outside
document.addEventListener('click', (e) => {
    if (!searchInBtn.contains(e.target) && !searchInPanel.contains(e.target)) {
        searchInPanel.classList.add('hidden');
    }
    if (!showChannelsBtn.contains(e.target) && !showChannelsPanel.contains(e.target)) {
        showChannelsPanel.classList.add('hidden');
    }
});

// ------------------------------------------
// 6. LOAD AND DISPLAY MOVIES (with channel filter)
// ------------------------------------------
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies = await getAllMovies();

    // Apply display filter (currentDisplayChannelIds)
    if (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) {
        // Show only movies whose channelId is in the selected list
        allMovies = allMovies.filter(movie => currentDisplayChannelIds.includes(movie.channelId));
    }
    // If currentDisplayChannelIds includes null, show all movies (no filtering)

    renderMovies(resultsGrid, allMovies, `Movies (${allMovies.length})`);
}

// ------------------------------------------
// 7. SEARCH ACTION
// ------------------------------------------
searchBtn.onclick = async () => {
    const query = searchInput.value.trim();
    if (!query) {
        resultsGrid.innerHTML = '<div class="stats">Enter a search term</div>';
        return;
    }

    const searchChannelId = currentSearchChannelId; // null = all channels
    resultsGrid.innerHTML = '<div class="stats">Searching...</div>';

    try {
        const moviesFromAPI = await searchYouTube(query, searchChannelId);
        if (moviesFromAPI.length === 0) {
            resultsGrid.innerHTML = '<div class="stats">No movies found</div>';
            return;
        }

        // Save each movie (will not duplicate, just add searchTerm)
        for (const movie of moviesFromAPI) {
            await saveMovie(movie, query);
        }

        // Refresh the displayed list
        await loadAndDisplayAll();
        searchInput.value = '';
    } catch (err) {
        console.error(err);
        resultsGrid.innerHTML = `<div class="stats">Error: ${err.message}</div>`;
    }
};

// ------------------------------------------
// 8. INITIALIZATION
// ------------------------------------------
buildSearchInPanel();
buildShowChannelsPanel();
loadAndDisplayAll();