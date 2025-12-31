const CACHE_NAME = 'cifraprox-v26';
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
    // Force new SW to take control immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Claim clients immediately
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

