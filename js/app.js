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
let dbReady = openDB();
// Default search channel: YouTube Free Movies (not All Channels)
let currentSearchChannelId = 'UCuVPpxrm2VAgpH3Ktln4HXg';   // ID from channels.js
let currentDisplayChannelIds = ['UCuVPpxrm2VAgpH3Ktln4HXg']; // default: free movies channel

// ------------------------------------------
// 4. SEARCH IN PANEL (single selection with checkboxes, visually consistent)
// ------------------------------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    function setChecked(checkboxToCheck) {
        // Uncheck all other checkboxes in this panel
        const allCheckboxes = searchInPanel.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(cb => {
            cb.checked = (cb === checkboxToCheck);
        });
        // Update currentSearchChannelId based on the checked one
        const checkedCb = Array.from(allCheckboxes).find(cb => cb.checked);
        if (checkedCb) {
            currentSearchChannelId = checkedCb.value === '' ? null : checkedCb.value;
        } else {
            currentSearchChannelId = null;
        }
        searchInPanel.classList.add('hidden'); // close panel after selection
    }

    // Option: All Channels
    const allLabel = document.createElement('label');
    const allCheckbox = document.createElement('input');
    allCheckbox.type = 'checkbox';
    allCheckbox.value = '';
    allCheckbox.checked = (currentSearchChannelId === null);
    allCheckbox.addEventListener('change', (e) => {
        if (allCheckbox.checked) {
            setChecked(allCheckbox);
        } else {
            // If unchecking, do nothing (but we ensure at least one remains checked? Better to keep one)
            // For simplicity, we prevent uncheck by re-checking if no other is checked? We'll just let it be,
            // but we want always one selected. We'll add logic: if unchecking and no other checked, re-check it.
            const anyChecked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).some(cb => cb.checked);
            if (!anyChecked) {
                allCheckbox.checked = true;
                setChecked(allCheckbox);
            } else {
                // Update state
                const checkedCb = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).find(cb => cb.checked);
                currentSearchChannelId = checkedCb ? (checkedCb.value === '' ? null : checkedCb.value) : null;
                searchInPanel.classList.add('hidden');
            }
        }
    });
    allLabel.appendChild(allCheckbox);
    allLabel.appendChild(document.createTextNode('All Channels'));
    searchInPanel.appendChild(allLabel);

    // Options for each real channel
    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = channel.id;
        checkbox.checked = (currentSearchChannelId === channel.id);
        checkbox.addEventListener('change', (e) => {
            if (checkbox.checked) {
                setChecked(checkbox);
            } else {
                // If unchecking, ensure at least one remains checked; if none, re-check the "All Channels"
                const anyChecked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).some(cb => cb.checked);
                if (!anyChecked) {
                    const allCb = searchInPanel.querySelector('input[value=""]');
                    if (allCb) {
                        allCb.checked = true;
                        setChecked(allCb);
                    }
                } else {
                    const checkedCb = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).find(cb => cb.checked);
                    currentSearchChannelId = checkedCb ? (checkedCb.value === '' ? null : checkedCb.value) : null;
                    searchInPanel.classList.add('hidden');
                }
            }
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(channel.name));
        searchInPanel.appendChild(label);
    });

    // If no checkbox matches currentSearchChannelId, ensure All Channels is checked
    const hasMatch = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).some(cb => {
        const val = cb.value === '' ? null : cb.value;
        return val === currentSearchChannelId;
    });
    if (!hasMatch) {
        const allCb = searchInPanel.querySelector('input[value=""]');
        if (allCb) {
            allCb.checked = true;
            currentSearchChannelId = null;
        }
    }
}

// ------------------------------------------
// 5. SHOW CHANNELS PANEL (multi selection with checkboxes, with separator)
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
            currentDisplayChannelIds = [null];
            updateShowChannelsCheckboxes();
        } else {
            currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
        }
        loadAndDisplayAll();
    });
    allLabel.appendChild(allCheckbox);
    allLabel.appendChild(document.createTextNode('All Channels'));
    showChannelsPanel.appendChild(allLabel);

    // Separator line
    const separator = document.createElement('hr');
    separator.className = 'panel-separator';
    showChannelsPanel.appendChild(separator);

    // Options for each real channel
    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = channel.id;
        checkbox.checked = currentDisplayChannelIds.includes(channel.id);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
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
            loadAndDisplayAll();
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(channel.name));
        showChannelsPanel.appendChild(label);
    });
}

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