// ==========================================
// js/app.js - Plato App (consistent dropdowns with delay)
// ==========================================

import { openDB, getAllMovies, saveMovie } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';
import { CHANNELS } from './channels.js';

// ---------------------- DOM elements ----------------------
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const searchInBtn = document.getElementById('searchInBtn');
const searchInPanel = document.getElementById('searchInPanel');
const showChannelsBtn = document.getElementById('showChannelsBtn');
const showChannelsPanel = document.getElementById('showChannelsPanel');

// ---------------------- Global state ----------------------
let dbReady = openDB();
let currentSearchChannelId = 'UCuVPpxrm2VAgpH3Ktln4HXg'; // default: YouTube Free Movies
let currentDisplayChannelIds = ['UCuVPpxrm2VAgpH3Ktln4HXg']; // default: free movies channel

// ---------------------- Helper: close all panels with optional delay ----------------------
function closeAllPanels() {
    searchInPanel.classList.add('hidden');
    showChannelsPanel.classList.add('hidden');
}

function closePanelWithDelay(panel) {
    setTimeout(() => {
        panel.classList.add('hidden');
    }, 150);
}

// ---------------------- Build Search In panel (exclusive checkboxes, closes with delay) ----------------------
function buildSearchInPanel() {
    searchInPanel.innerHTML = '';

    // Exclusive logic: only one checkbox can be checked at a time, then close panel with delay
    function setExclusive(clickedCheckbox) {
        const all = searchInPanel.querySelectorAll('input[type="checkbox"]');
        all.forEach(cb => {
            cb.checked = (cb === clickedCheckbox);
        });
        const checked = Array.from(all).find(cb => cb.checked);
        currentSearchChannelId = checked ? (checked.value === '' ? null : checked.value) : null;
        closePanelWithDelay(searchInPanel);
    }

    // All Channels
    const allLabel = document.createElement('label');
    const allCb = document.createElement('input');
    allCb.type = 'checkbox';
    allCb.value = '';
    allCb.checked = (currentSearchChannelId === null);
    allCb.addEventListener('change', () => {
        if (allCb.checked) setExclusive(allCb);
        else {
            const anyChecked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).some(cb => cb.checked);
            if (!anyChecked) {
                allCb.checked = true;
                setExclusive(allCb);
            } else {
                const checked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).find(cb => cb.checked);
                currentSearchChannelId = checked ? (checked.value === '' ? null : checked.value) : null;
                closePanelWithDelay(searchInPanel);
            }
        }
    });
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode('All Channels'));
    searchInPanel.appendChild(allLabel);

    // Real channels
    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = channel.id;
        cb.checked = (currentSearchChannelId === channel.id);
        cb.addEventListener('change', () => {
            if (cb.checked) setExclusive(cb);
            else {
                const anyChecked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).some(c => c.checked);
                if (!anyChecked) {
                    const allCb2 = searchInPanel.querySelector('input[value=""]');
                    if (allCb2) {
                        allCb2.checked = true;
                        setExclusive(allCb2);
                    }
                } else {
                    const checked = Array.from(searchInPanel.querySelectorAll('input[type="checkbox"]')).find(c => c.checked);
                    currentSearchChannelId = checked ? (checked.value === '' ? null : checked.value) : null;
                    closePanelWithDelay(searchInPanel);
                }
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(channel.name));
        searchInPanel.appendChild(label);
    });
}

// ---------------------- Build Show Channels panel (multi-checkbox with separator, closes with delay) ----------------------
function buildShowChannelsPanel() {
    showChannelsPanel.innerHTML = '';

    // Helper to close this panel after a short delay
    function closeThisPanelWithDelay() {
        setTimeout(() => {
            showChannelsPanel.classList.add('hidden');
        }, 150);
    }

    // All Channels option
    const allLabel = document.createElement('label');
    const allCb = document.createElement('input');
    allCb.type = 'checkbox';
    allCb.value = '';
    allCb.checked = currentDisplayChannelIds.includes(null);
    allCb.addEventListener('change', () => {
        if (allCb.checked) {
            currentDisplayChannelIds = [null];
        } else {
            currentDisplayChannelIds = currentDisplayChannelIds.filter(id => id !== null);
        }
        updateShowChannelsCheckboxes();
        loadAndDisplayAll();
        closeThisPanelWithDelay();
    });
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode('All Channels'));
    showChannelsPanel.appendChild(allLabel);

    // Separator
    const sep = document.createElement('hr');
    sep.className = 'panel-separator';
    showChannelsPanel.appendChild(sep);

    // Real channels
    CHANNELS.filter(ch => ch.id !== null).forEach(channel => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = channel.id;
        cb.checked = currentDisplayChannelIds.includes(channel.id);
        cb.addEventListener('change', () => {
            if (cb.checked) {
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
            closeThisPanelWithDelay();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(channel.name));
        showChannelsPanel.appendChild(label);
    });
}

function updateShowChannelsCheckboxes() {
    const checkboxes = showChannelsPanel.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const val = cb.value === '' ? null : cb.value;
        cb.checked = currentDisplayChannelIds.includes(val);
    });
}

// ---------------------- Panel toggle logic ----------------------
searchInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // If opening, close the other panel
    if (searchInPanel.classList.contains('hidden')) {
        showChannelsPanel.classList.add('hidden');
    }
    searchInPanel.classList.toggle('hidden');
});

showChannelsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (showChannelsPanel.classList.contains('hidden')) {
        searchInPanel.classList.add('hidden');
    }
    showChannelsPanel.classList.toggle('hidden');
});

// Close panels when clicking outside
document.addEventListener('click', (e) => {
    if (!searchInBtn.contains(e.target) && !searchInPanel.contains(e.target)) {
        searchInPanel.classList.add('hidden');
    }
    if (!showChannelsBtn.contains(e.target) && !showChannelsPanel.contains(e.target)) {
        showChannelsPanel.classList.add('hidden');
    }
});

// ---------------------- Load and display movies ----------------------
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies = await getAllMovies();
    if (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) {
        allMovies = allMovies.filter(movie => currentDisplayChannelIds.includes(movie.channelId));
    }
    renderMovies(resultsGrid, allMovies, `Movies (${allMovies.length})`);
}

// ---------------------- Search ----------------------
searchBtn.onclick = async () => {
    const query = searchInput.value.trim();
    if (!query) {
        resultsGrid.innerHTML = '<div class="stats">Enter a search term</div>';
        return;
    }
    const searchChannelId = currentSearchChannelId;
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

// ---------------------- Initialization ----------------------
buildSearchInPanel();
buildShowChannelsPanel();
loadAndDisplayAll();