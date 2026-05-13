// js/db.js
// Handles IndexedDB operations for Plato app

const DB_NAME = 'PlatoDB';
const DB_VERSION = 1;
const STORE_MOVIES = 'movies';

let dbInstance = null;

// Open database connection
export async function openDB() {
    if (dbInstance) return dbInstance;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_MOVIES)) {
                const store = db.createObjectStore(STORE_MOVIES, { keyPath: 'youtubeId' });
                store.createIndex('by_dateSaved', 'dateSaved', { unique: false });
                store.createIndex('by_watching', 'watching', { unique: false });
                store.createIndex('by_favorite', 'favorite', { unique: false });
            }
        };
    });
}

// Save or update a movie: add searchTerm to searchTerms array
export async function saveMovie(movieData, searchTerm) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    
    return new Promise((resolve, reject) => {
        const getRequest = store.get(movieData.youtubeId);
        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (existing) {
                // Update: merge searchTerms, refresh stats
                const termsSet = new Set(existing.searchTerms || []);
                if (searchTerm) termsSet.add(searchTerm);
                const updated = {
                    ...existing,
                    searchTerms: Array.from(termsSet),
                    viewCount: movieData.viewCount ?? existing.viewCount,
                    likeCount: movieData.likeCount ?? existing.likeCount,
                    commentCount: movieData.commentCount ?? existing.commentCount,
                    duration: movieData.duration ?? existing.duration,
                    lastUpdated: new Date().toISOString()
                };
                const putRequest = store.put(updated);
                putRequest.onsuccess = () => resolve(updated);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                // Insert new movie
                const newMovie = {
                    ...movieData,
                    searchTerms: searchTerm ? [searchTerm] : [],
                    watching: false,
                    favorite: false,
                    dateSaved: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
                const addRequest = store.add(newMovie);
                addRequest.onsuccess = () => resolve(newMovie);
                addRequest.onerror = () => reject(addRequest.error);
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}