const CACHE_NAME = 'cifraprox-v25';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './chords.js',
    './logo.png',
    './manifest.json',
    './icons/abafado para baixo.svg',
    './icons/abafado para cima.svg',
    './icons/abafado.svg',
    './icons/batida circular.svg',
    './icons/batida para baixo.svg',
    './icons/batida para cima.svg',
    './icons/genero_acustico.svg',
    './icons/genero_mpb.svg',
    './icons/genero_rock.svg',
    './icons/genero_sertanejo.svg',
    './icons/repertorio.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
