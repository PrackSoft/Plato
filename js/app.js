// js/app.js
import { openDB, getAllMovies, saveMovie } from './db.js';
import { searchYouTube } from './api/youtube.js';
import { renderMovies } from './render.js';
import { CHANNELS, getChannelName } from './channels.js';

let dbReady = openDB();

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');

// Elementos de los dropdowns
const searchChannelBtn = document.getElementById('searchChannelBtn');
const searchChannelSelect = document.getElementById('searchChannelSelect');
const displayFilterBtn = document.getElementById('displayFilterBtn');
const displayFilterPanel = document.getElementById('displayFilterPanel');

let currentDisplayChannelIds = []; // array de IDs seleccionados (null significa "todos")

// Llenar el select de búsqueda (exclusivo)
CHANNELS.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel.id === null ? '' : channel.id;
    option.textContent = channel.name;
    searchChannelSelect.appendChild(option);
});

// Mostrar el select nativo al hacer clic en el botón (simulamos dropdown)
searchChannelBtn.addEventListener('click', () => {
    searchChannelSelect.click(); // abre el select nativo
});
// Sincronizar el texto del botón con la selección actual
searchChannelSelect.addEventListener('change', () => {
    const selectedOption = searchChannelSelect.options[searchChannelSelect.selectedIndex];
    const selectedName = selectedOption.textContent;
    // Actualizar el botón manteniendo el ícono
    searchChannelBtn.innerHTML = `<span class="material-symbols-outlined">subscriptions</span> ${selectedName} <span class="material-symbols-outlined">arrow_drop_down</span>`;
    // No es necesario reiniciar búsqueda, solo cambiar el canal para futuras búsquedas
});
// Forzar cambio inicial para que el botón muestre el primer canal
searchChannelSelect.dispatchEvent(new Event('change'));

// Construir el panel de checkboxes para filtro de visualización
function buildDisplayFilterPanel() {
    displayFilterPanel.innerHTML = '';
    CHANNELS.forEach(channel => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = channel.id === null ? '' : channel.id;
        // Por defecto, seleccionar el canal de películas gratis (si existe)
        const isFreeMovies = channel.id === 'UCuVPpxrm2VAgpH3Ktln4HXg';
        checkbox.checked = isFreeMovies;
        checkbox.addEventListener('change', () => {
            updateDisplayFilter();
            loadAndDisplayAll();
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(channel.name));
        displayFilterPanel.appendChild(label);
    });
    updateDisplayFilter(); // inicializar currentDisplayChannelIds
}

function updateDisplayFilter() {
    const checkboxes = displayFilterPanel.querySelectorAll('input[type="checkbox"]');
    currentDisplayChannelIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value === '' ? null : cb.value);
}

// Toggle del panel de filtros al hacer clic en el botón
displayFilterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    displayFilterPanel.classList.toggle('hidden');
});
// Cerrar panel si se hace clic fuera
document.addEventListener('click', (e) => {
    if (!displayFilterBtn.contains(e.target) && !displayFilterPanel.contains(e.target)) {
        displayFilterPanel.classList.add('hidden');
    }
});

// Cargar y mostrar películas aplicando el filtro de canales
async function loadAndDisplayAll() {
    await dbReady;
    let allMovies = await getAllMovies();
    // Aplicar filtro según currentDisplayChannelIds
    if (currentDisplayChannelIds.length > 0 && !currentDisplayChannelIds.includes(null)) {
        allMovies = allMovies.filter(movie => currentDisplayChannelIds.includes(movie.channelId));
    } // si incluye null, mostrar todos (sin filtro)
    renderMovies(resultsGrid, allMovies, `Movies (${allMovies.length})`);
}

// Búsqueda y guardado
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

// Inicializar
buildDisplayFilterPanel();
loadAndDisplayAll();