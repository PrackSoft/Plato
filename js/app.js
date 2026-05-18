// js/db.js
const DB_NAME = 'PlatoDB';
const DB_VERSION = 2;
const STORE_MOVIES = 'movies';
const STORE_TRASH = 'trash';

let dbInstance = null;

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
                store.createIndex('by_channelId', 'channelId', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_TRASH)) {
                const trashStore = db.createObjectStore(STORE_TRASH, { keyPath: 'youtubeId' });
                trashStore.createIndex('by_deletedAt', 'deletedAt', { unique: false });
                trashStore.createIndex('by_channelId', 'channelId', { unique: false });
            }
        };
    });
}

export async function saveMovie(movieData, searchTerm) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(movieData.youtubeId);
        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (existing) {
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

export async function getAllMovies() {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readonly');
    const store = transaction.objectStore(STORE_MOVIES);
    const index = store.index('by_dateSaved');
    return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev');
        const movies = [];
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                movies.push(cursor.value);
                cursor.continue();
            } else {
                resolve(movies);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function getTrashMovies() {
    const db = await openDB();
    const transaction = db.transaction([STORE_TRASH], 'readonly');
    const store = transaction.objectStore(STORE_TRASH);
    const index = store.index('by_deletedAt');
    return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev');
        const movies = [];
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                movies.push(cursor.value);
                cursor.continue();
            } else {
                resolve(movies);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

export async function moveMovieToTrash(youtubeId) {
    const db = await openDB();
    const mainStore = db.transaction([STORE_MOVIES], 'readonly').objectStore(STORE_MOVIES);
    const movie = await new Promise((resolve, reject) => {
        const req = mainStore.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (!movie) throw new Error('Movie not found');
    const trashMovie = { ...movie, deletedAt: new Date().toISOString() };
    const trashTransaction = db.transaction([STORE_TRASH], 'readwrite');
    const trashStore = trashTransaction.objectStore(STORE_TRASH);
    await new Promise((resolve, reject) => {
        const req = trashStore.put(trashMovie);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
    const mainTransaction = db.transaction([STORE_MOVIES], 'readwrite');
    const mainDeleteStore = mainTransaction.objectStore(STORE_MOVIES);
    await new Promise((resolve, reject) => {
        const req = mainDeleteStore.delete(youtubeId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function restoreMovieFromTrash(youtubeId) {
    const db = await openDB();
    const trashStore = db.transaction([STORE_TRASH], 'readonly').objectStore(STORE_TRASH);
    const trashMovie = await new Promise((resolve, reject) => {
        const req = trashStore.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (!trashMovie) throw new Error('Movie not found in trash');
    const { deletedAt, ...restoredMovie } = trashMovie;
    const mainTransaction = db.transaction([STORE_MOVIES], 'readwrite');
    const mainStore = mainTransaction.objectStore(STORE_MOVIES);
    await new Promise((resolve, reject) => {
        const req = mainStore.put(restoredMovie);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
    const trashDeleteTransaction = db.transaction([STORE_TRASH], 'readwrite');
    const trashDeleteStore = trashDeleteTransaction.objectStore(STORE_TRASH);
    await new Promise((resolve, reject) => {
        const req = trashDeleteStore.delete(youtubeId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function permanentlyDeleteMovie(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction([STORE_TRASH], 'readwrite');
    const store = transaction.objectStore(STORE_TRASH);
    return new Promise((resolve, reject) => {
        const req = store.delete(youtubeId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function toggleWatching(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    return new Promise((resolve, reject) => {
        const getRequest = store.get(youtubeId);
        getRequest.onsuccess = () => {
            const movie = getRequest.result;
            if (movie) {
                movie.watching = !movie.watching;
                movie.lastUpdated = new Date().toISOString();
                const putRequest = store.put(movie);
                putRequest.onsuccess = () => resolve(movie.watching);
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Movie not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

export async function renameTermInAllMovies(oldTerm, newTerm) {
    if (oldTerm === newTerm) return;
    const db = await openDB();
    const allMovies = await getAllMovies();
    const transaction = db.transaction([STORE_MOVIES], 'readwrite');
    const store = transaction.objectStore(STORE_MOVIES);
    for (const movie of allMovies) {
        if (movie.searchTerms && movie.searchTerms.includes(oldTerm)) {
            const newTerms = movie.searchTerms.map(t => t === oldTerm ? newTerm : t);
            movie.searchTerms = newTerms;
            movie.lastUpdated = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = store.put(movie);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }
}