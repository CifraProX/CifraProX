const app = {
    state: {
        user: null, // Default to null (Guest)
        currentCifra: null,
        cifras: [],
        setlists: [],
        currentSetlist: null,
        currentSetlistIndex: -1,
        unsubs: { cifras: null, setlists: null }, // Control for listeners
        metronome: { interval: null, bpm: 0, active: false }
    },

    // --- CONFIGURAÇÃO DO FIREBASE ---
    // O usuário deve preencher estes dados obtidos no Console do Firebase
    firebaseConfig: {
        apiKey: "AIzaSyAhyGljpun7I-s_HauY0ZIeMniZTryd6To",
        authDomain: "cifraproxs.firebaseapp.com",
        databaseURL: "https://cifraproxs-default-rtdb.firebaseio.com",
        projectId: "cifraproxs",
        storageBucket: "cifraproxs.firebasestorage.app",
        messagingSenderId: "1042189849606",
        appId: "1:1042189849606:web:b7111933eb92fb52765f87",
        measurementId: "G-2GFG988YK3"
    },

    db: null, // Firestore reference
    auth: null, // Auth reference

    init: async () => {
        try {
            console.log('Iniciando app (Firebase Mode)...');

            // Robust check for Firebase availability (especially for offline)
            if (typeof firebase === 'undefined') {
                throw new Error('O SDK do Firebase não pôde ser carregado. Verifique sua conexão ou o cache do navegador.');
            }

            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(app.firebaseConfig);
            }
            app.db = firebase.firestore();
            app.auth = firebase.auth();

            // Ativar Persistência Offline do Firestore
            try {
                await app.db.enablePersistence({ synchronizeTabs: true });
                console.log('Persistência offline ativada!');
            } catch (err) {
                if (err.code == 'failed-precondition') {
                    console.warn('Persistência falhou: Múltiplas abas abertas.');
                } else if (err.code == 'unimplemented') {
                    console.warn('Persistência não suportada pelo navegador.');
                }
            }

            // Initialize Theme
            const savedTheme = localStorage.getItem('theme') || 'light';
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-mode');
                app.updateThemeIcons();
            }

            // Load custom chords on startup
            await app.loadCustomChords();

            // Start listening immediately (as guest)
            app.initRealtimeListeners();

            // Listen for Auth changes
            app.auth.onAuthStateChanged((user) => {
                // Clear state when auth changes to ensure correct data per access level
                app.state.cifras = [];

                if (user) {
                    app.state.user = {
                        uid: user.uid,
                        email: user.email,
                        username: 'Admin',
                        role: 'admin'
                    };
                } else {
                    app.state.user = null;
                    app.stopRealtimeListeners(); // Just to be clean before restart
                }

                // Re-initialize listeners with new user state
                app.initRealtimeListeners();

                app.renderHeader(app.state.currentView);

                // Update Home UI elements (Create Button)
                if (app.state.currentView === 'home') {
                    const btnCreate = document.getElementById('btn-create');
                    if (btnCreate) {
                        btnCreate.style.display = app.state.user ? 'block' : 'none';
                    }
                }
            });

            // Register Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register fail:', err));
            }

            // Evento para botão voltar do navegador/celular
            window.onpopstate = (event) => {
                if (event.state && event.state.view) {
                    app.navigate(event.state.view, event.state.param, true);
                } else {
                    // Se não tiver estado, tenta inferir pelo hash ou vai para home
                    const hash = location.hash.substring(1);
                    if (hash) {
                        const [view, param] = hash.split('/');
                        app.navigate(view, param || null, true);
                    } else {
                        app.navigate('home', null, true);
                    }
                }
            };

            // Monitor de Rede (Offline)
            window.addEventListener('online', app.updateNetworkStatus);
            window.addEventListener('offline', app.updateNetworkStatus);
            app.updateNetworkStatus();

            // Setup inicial
            const view = location.hash ? location.hash.substring(1).split('/')[0] : 'home';
            const param = location.hash ? location.hash.substring(1).split('/')[1] : null;

            // Substitui o estado inicial para ter a URL correta logo de cara
            history.replaceState({ view, param }, '', location.hash || '#home');
            app.navigate(view, param, true);
        } catch (error) {
            document.body.innerHTML = `<div style="color:red; padding:20px;">ERRO FATAL: ${error.message}</div>`;
            console.error(error);
        }
    },

    navigate: async (view, param = null, fromHistory = false) => {
        // Stop scroll when navigating
        if (app.scrollState && app.scrollState.active) {
            app.scrollState.active = false;
            if (app.scrollState.currentInterval) {
                clearInterval(app.scrollState.currentInterval);
            }
        }

        // Stop player when navigating
        if (app.musicPlayerActive) {
            app.toggleMusicPlayer(false);
        }

        // Atualiza histórico se necessário
        if (!fromHistory) {
            const hash = '#' + view + (param ? '/' + param : '');
            history.pushState({ view, param }, '', hash);
        }

        const main = document.getElementById('app');
        main.innerHTML = '';

        let templateId = `view-${view}`;
        const template = document.getElementById(templateId);

        if (!template) return;

        const clone = template.content.cloneNode(true);
        main.appendChild(clone);

        app.state.currentView = view;

        // Update header AFTER appending content so templates can be accessed if needed
        app.renderHeader(view);

        // Reset setlist state if navigating home or other main views
        if (view === 'home' || view === 'library' || view === 'setlists' || view === 'login') {
            app.state.currentSetlist = null;
            app.state.currentSetlistIndex = -1;
        }

        // View logic
        if (view === 'home') {
            app.loadCifras();
            const btnCreate = document.getElementById('btn-create');
            if (app.state.user) btnCreate.style.display = 'block';
        } else if (view === 'cifra') {
            app.loadCifra(param);
        } else if (view === 'editor') {
            if (!app.state.user) {
                app.navigate('login');
                return;
            }
            if (param) app.loadEditor(param);
        } else if (view === 'library') {
            app.loadLibrary();
        } else if (view === 'setlists') {
            app.loadSetlists();
        } else if (view === 'login') {
            // No specific logic needed, form is in template
        }

        // Update offline banner visibility (home only)
        app.updateNetworkStatus();
    },

    toggleTheme: () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        app.updateThemeIcons();
    },

    updateThemeIcons: () => {
        const isDark = document.body.classList.contains('dark-mode');
        const sun = document.getElementById('theme-icon-sun');
        const moon = document.getElementById('theme-icon-moon');
        if (sun && moon) {
            sun.style.display = isDark ? 'block' : 'none';
            moon.style.display = isDark ? 'none' : 'block';
        }
    },

    extractYouTubeId: (url) => {
        if (!url) return null;
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    toggleMusicPlayer: (forceState = null) => {
        const modal = document.getElementById('music-player-modal');
        const container = document.getElementById('music-player-container');
        const titleSpan = document.getElementById('player-song-title');

        const newState = forceState !== null ? forceState : (modal.style.display === 'none');
        app.musicPlayerActive = newState;

        if (newState) {
            const url = app.state.currentCifra?.youtube;
            const id = app.extractYouTubeId(url);
            if (!id) {
                app.showToast('Link do YouTube inválido.');
                return;
            }
            titleSpan.innerText = app.state.currentCifra.title;

            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('active'));

            const isLocalFile = window.location.protocol === 'file:';
            const origin = isLocalFile ? null : window.location.origin;

            // Se o player já existe, apenas carregar novo vídeo
            if (app.ytPlayer && typeof app.ytPlayer.loadVideoById === 'function') {
                app.ytPlayer.loadVideoById(id);
            } else {
                // Criar player usando a API oficial
                if (typeof YT !== 'undefined' && YT.Player) {
                    app.ytPlayer = new YT.Player('music-player-container', {
                        height: '157',
                        width: '280',
                        host: 'https://www.youtube-nocookie.com',
                        videoId: id,
                        playerVars: {
                            'autoplay': 1,
                            'playsinline': 1,
                            'rel': 0,
                            'showinfo': 0,
                            'modestbranding': 1,
                            'enablejsapi': 1,
                            'origin': origin,
                            'widget_referrer': window.location.href
                        },
                        events: {
                            'onReady': (event) => {
                                event.target.playVideo();
                            },
                            'onError': (event) => {
                                console.warn('YouTube Player Error:', event.data);
                                if (isLocalFile && event.data === 153) {
                                    app.showToast('Nota: Alguns vídeos de música só tocam quando o site está online (GitHub).');
                                }
                            }
                        }
                    });
                } else {
                    // Fallback
                    const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
                    container.innerHTML = `<iframe width="280" height="157" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1${originParam}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
                }
            }
        } else {
            modal.classList.remove('active');
            if (app.ytPlayer && typeof app.ytPlayer.pauseVideo === 'function') {
                app.ytPlayer.pauseVideo();
            }
            setTimeout(() => {
                modal.style.display = 'none';
                if (!app.ytPlayer) container.innerHTML = '';
            }, 400);
        }
    },

    updateNetworkStatus: () => {
        const isOffline = !navigator.onLine;
        const banner = document.getElementById('offline-status');
        if (banner) {
            // Only show banner if offline AND on home view
            if (isOffline && (app.state.currentView === 'home' || !app.state.currentView)) {
                banner.style.display = 'block';
            } else {
                banner.style.display = 'none';
            }
        }
    },

    renderHeader: (view) => {
        const navLinks = document.getElementById('nav-links');

        // Logic for 'cifra' view - Contextual Actions
        if (view === 'cifra') {
            let userActions = '';
            // Only show management actions if logged in AND NOT in a setlist session
            if (app.state.user && !app.state.currentSetlist) {
                userActions = `
                    <a href="javascript:void(0)" class="nav-link" onclick="app.editCurrent()">Editar</a>
                    <a href="javascript:void(0)" class="nav-link" style="color:var(--danger-color)" onclick="app.deleteCurrent()">Excluir</a>
                `;
            }
            navLinks.innerHTML = `
                ${userActions}
                <a href="javascript:void(0)" class="nav-link" onclick="app.navigate('${app.state.currentSetlist ? 'setlists' : 'home'}')">Voltar</a>
            `;

            // Render Setlist Nav if in a setlist session
            if (app.state.currentSetlist) app.renderSetlistNavigator();
            return;
        }

        // Hide setlist nav if not in cifra view
        const setlistNav = document.getElementById('setlist-navigator');
        if (setlistNav) setlistNav.style.display = 'none';

        // Logic for 'editor' view
        if (view === 'editor') {
            navLinks.innerHTML = `
                <a href="javascript:void(0)" class="nav-link" style="color:var(--primary-color); font-weight:bold;" onclick="document.querySelector('#app form').requestSubmit()">Salvar Cifra</a>
                <a href="javascript:void(0)" class="nav-link" style="color:var(--danger-color)" onclick="app.navigate('home')">Cancelar</a>
            `;
            return;
        }

        // Logic for other views (Home, Library, etc)
        if (view === 'setlists') {
            navLinks.innerHTML = `
                <a href="javascript:void(0)" class="nav-link" style="color:var(--primary-color); font-weight:bold;" onclick="app.promptCreateSetlist()">+ Novo Repertório</a>
                <a href="javascript:void(0)" class="nav-link" onclick="app.navigate('home')">Voltar</a>
            `;
            return;
        }

        if (view === 'library') {
            navLinks.innerHTML = `<a href="javascript:void(0)" class="nav-link" onclick="app.navigate('home')">Voltar</a>`;
            return;
        }

        if (app.state.user) {
            navLinks.innerHTML = `
                <a href="javascript:void(0)" class="nav-link" onclick="app.navigate('setlists')">Repertórios</a>
                <a href="javascript:void(0)" class="nav-link" onclick="app.navigate('library')">Acordes</a>
                <a href="javascript:void(0)" class="nav-link" onclick="app.logout()">Sair</a>
            `;
        } else {
            navLinks.innerHTML = `
                <a href="javascript:void(0)" class="nav-link" style="color:var(--primary-color); font-weight:bold;" onclick="app.navigate('login')">Entrar</a>
            `;
        }
    },

    login: async (e) => {
        e.preventDefault();
        const form = e.target;
        const email = form.email.value;
        const password = form.password.value;

        try {
            await app.auth.signInWithEmailAndPassword(email, password);
            app.navigate('home');
        } catch (error) {
            console.error('Erro no login:', error);
            let msg = 'Erro ao entrar. Verifique seus dados.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                msg = 'E-mail ou senha incorretos.';
            }
            alert(msg);
        }
    },

    logout: async () => {
        try {
            await app.auth.signOut();
            app.navigate('home');
        } catch (e) {
            console.error(e);
        }
    },

    getChordId: (name) => {
        if (!name) return '';
        // Substituir caracteres inválidos/reservados do Firestore
        return name.replace(/\//g, '_').replace(/\./g, '-');
    },

    // --- REALTIME LISTENERS ---
    initRealtimeListeners: () => {
        app.stopRealtimeListeners();

        // Query base: Se não estiver logado, vê apenas prontas. Se logado, vê tudo.
        let query = app.db.collection('cifras');
        if (!app.state.user) {
            query = query.where('ready', '==', true);
        }

        // Listen to Cifras - Sort in memory to avoid index requirements
        app.state.unsubs.cifras = query.onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            app.state.cifras = data;
            if (app.state.currentView === 'home') app.filterCifras();
        }, error => {
            console.error('Erro no listener de cifras:', error);
        });

        // Listen to Setlists
        app.state.unsubs.setlists = app.db.collection('setlists').onSnapshot(snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            app.state.setlists = data;
            if (app.state.currentView === 'setlists') app.renderSetlistsGrid();
        });
    },

    stopRealtimeListeners: () => {
        if (app.state.unsubs.cifras) {
            app.state.unsubs.cifras();
            app.state.unsubs.cifras = null;
        }
        if (app.state.unsubs.setlists) {
            app.state.unsubs.setlists();
            app.state.unsubs.setlists = null;
        }
    },

    loadCustomChords: async () => {
        try {
            const snap = await app.db.collection('custom_chords').get();
            snap.forEach(doc => {
                const data = doc.data();
                if (data.name && data.variations) {
                    Chords.dict[data.name] = data.variations;
                }
            });
        } catch (e) {
            console.error('Erro ao carregar acordes:', e);
        }
    },

    // --- FIRESTORE OPERATIONS ---

    loadCifras: async () => {
        const list = document.getElementById('cifra-list');
        if (!list) return;

        // Se já temos dados no estado (carregados pelo listener tempo real), apenas renderiza
        if (app.state.cifras.length > 0) {
            app.filterCifras();
            return;
        }

        list.innerHTML = '<p style="color:var(--text-muted)">Carregando...</p>';
        // Com a unificação, NÃO fazemos mais o fetch manual aqui.
        // O initRealtimeListeners iniciado no app.init() cuidará de popular o estado.
    },

    filterCifras: () => {
        const list = document.getElementById('cifra-list');
        const searchTerm = document.getElementById('filter-search')?.value.toLowerCase().trim() || '';
        const genreFilter = document.getElementById('filter-genre')?.value || '';
        const capoFilter = document.getElementById('filter-capo')?.value || '';

        const filtered = app.state.cifras.filter(c => {
            // Privacy Filter: Guest sees only ready chords
            if (!app.state.user && !c.ready) return false;

            const title = (c.title || '').toLowerCase();
            const artist = (c.artist || '').toLowerCase();

            const matchesSearch = title.includes(searchTerm) || artist.includes(searchTerm);
            const matchesGenre = genreFilter ? c.genre === genreFilter : true;
            const matchesCapo = capoFilter ? (capoFilter === 'Sem Capo' ? (!c.capo || c.capo === 'Sem Capo') : c.capo === capoFilter) : true;

            return matchesSearch && matchesGenre && matchesCapo;
        });

        if (filtered.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted)">Nenhuma cifra encontrada para os filtros selecionados.</p>';
            return;
        }

        list.innerHTML = filtered.map(c => `
            <div class="cifra-card" onclick="app.navigate('cifra', '${c.id}'); app.state.currentSetlist = null;">
                ${app.state.user ? `
                    <button class="btn-setlist-add" title="Adicionar ao Repertório" 
                    onclick="event.stopPropagation(); app.addToSetlistPrompt('${c.id}')">
                        +
                    </button>
                ` : ''}
                <div class="cifra-title">${c.title}</div>
                <div class="cifra-artist">${c.artist}</div>
                <div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
                    ${!c.ready ? `<span style="font-size:0.75rem; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; border: 1px solid #fecaca;">Rascunho</span>` : ''}
                    ${c.genre ? `<span style="font-size:0.75rem; background:#e0f2f1; color:#00695c; padding:2px 6px; border-radius:4px;">${c.genre}</span>` : ''}
                    ${(c.capo && app.state.user) ? `<span style="font-size:0.75rem; background:#f3e5f5; color:#4a148c; padding:2px 6px; border-radius:4px;">🎸 ${c.capo}</span>` : ''}
                </div>
                ${app.getGenreIcon(c.genre)}
            </div>
        `).join('');
    },

    showToast: (message) => {
        const toast = document.createElement('div');
        toast.innerText = message;
        toast.style.cssText = 'position:fixed; bottom: 100px; right: 2rem; background: var(--bg-header); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; z-index: 2100; box-shadow: 0 4px 6px rgba(0,0,0,0.1); opacity: 0; transition: opacity 0.3s; pointer-events:none;';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = '1');
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // --- MODAL SYSTEM (Premium Dialogs) ---
    modal: ({ title, content, input = false, confirmText = 'OK', cancelText = 'Cancelar', placeholder = '' }) => {
        return new Promise((resolve) => {
            const root = document.getElementById('modal-root');
            const id = 'modal-' + Date.now();

            const html = `
                <div class="modal-overlay" id="${id}">
                    <div class="modal-container">
                        <div class="modal-title">${title}</div>
                        <div class="modal-content">${content}</div>
                        ${input ? `<input type="text" class="modal-input" id="${id}-input" placeholder="${placeholder}" autofocus>` : ''}
                        <div class="modal-actions">
                            ${cancelText ? `<button class="btn btn-outline" id="${id}-cancel">${cancelText}</button>` : ''}
                            <button class="btn btn-primary" id="${id}-confirm">${confirmText}</button>
                        </div>
                    </div>
                </div>
            `;

            root.insertAdjacentHTML('beforeend', html);
            const modalEl = document.getElementById(id);

            // Trigger animation
            requestAnimationFrame(() => document.body.classList.add('modal-active'));

            const cleanup = (value) => {
                document.body.classList.remove('modal-active');
                modalEl.style.opacity = '0';
                setTimeout(() => {
                    modalEl.remove();
                    resolve(value);
                }, 300);
            };

            const inputField = document.getElementById(`${id}-input`);
            if (inputField) {
                inputField.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') document.getElementById(`${id}-confirm`).click();
                });
            }

            document.getElementById(`${id}-confirm`).onclick = () => {
                // If it's a generic input, resolve with its value
                if (input) {
                    cleanup(inputField.value);
                    return;
                }

                // Custom logic for Chord Creator: grab values before they disappear from DOM
                const nameInp = document.getElementById('new-chord-name');
                const barInp = document.getElementById('chord-bar');
                const noBarInp = document.getElementById('chord-no-bar');

                if (nameInp && barInp) {
                    cleanup({
                        name: nameInp.value,
                        bar: parseInt(barInp.value),
                        noBar: noBarInp ? noBarInp.checked : false
                    });
                } else {
                    cleanup(true);
                }
            };

            if (cancelText) {
                document.getElementById(`${id}-cancel`).onclick = () => cleanup(null);
            }
        });
    },

    getGenreIcon: (genre) => {
        if (!genre) return '';
        const map = {
            'Sertanejo': 'genero_sertanejo.svg',
            'Rock': 'genero_rock.svg',
            'MPB': 'genero_mpb.svg',
            'Acústico': 'genero_acustico.svg'
        };
        const file = map[genre];
        return file ? `<img src="icons/${file}" class="genre-icon-bg">` : '';
    },

    isActualChord: (name) => {
        if (!name) return false;
        // Ignora marcadores de loop e pausa
        if (name.includes('|') || name.includes('.') || name.startsWith('p|')) return false;

        const clean = name.trim().toLowerCase();

        // Lista negra de termos comuns que não são acordes
        const blacklist = ['intro', 'solo', 'riff', 'refrão', 'ponte', 'bridge', 'final', 'outro', 'instrumental', 'parte', 'pré-refrão', 'coro', 'batida', 'ritmo'];
        if (blacklist.some(term => clean.includes(term))) return false;

        // Ignora frases ou nomes muito longos (seções)
        if (clean.length > 10 || clean.includes(' ')) return false;

        // Padrão básico de acorde (Começa com A-G)
        return /^[A-Ga-g]/.test(clean);
    },

    loadCifra: async (id) => {
        try {
            const doc = await app.db.collection('cifras').doc(id).get();

            if (!doc.exists) {
                alert('Cifra não encontrada.');
                app.navigate('home');
                return;
            }

            const data = { id: doc.id, ...doc.data() };

            // --- Metronome Setup ---
            app.stopMetronome();
            if (data.bpm) {
                app.state.metronome.bpm = parseInt(data.bpm);
                document.getElementById('metronome-bpm-label').innerText = `BPM: ${data.bpm}`;
                document.getElementById('metronome-display').style.display = 'flex';
                app.startMetronome();
            } else {
                document.getElementById('metronome-display').style.display = 'none';
            }

            // --- YouTube Setup ---
            const btnYoutube = document.getElementById('btn-youtube-view');
            if (data.youtube) {
                btnYoutube.style.display = 'flex';
                // No need for onclick here as it's in the HTML now (app.toggleMusicPlayer)
            } else {
                btnYoutube.style.display = 'none';
            }
            // Populate logic same as before...

            app.state.currentCifra = data;
            document.getElementById('view-title').innerText = data.title;
            document.getElementById('view-artist').innerText = data.artist;

            const genreEl = document.getElementById('view-genre');
            const capoEl = document.getElementById('view-capo');

            if (data.genre) {
                genreEl.innerText = `🎵 ${data.genre}`;
                genreEl.style.display = 'inline-block';
            } else {
                genreEl.style.display = 'none';
            }

            if (data.capo) {
                capoEl.innerText = `🎸 ${data.capo}`;
                capoEl.style.display = 'inline-block';
            } else {
                capoEl.style.display = 'none';
            }

            // --- Render Content & Loops ---
            let contentHtml = data.content;
            contentHtml = contentHtml.replace(/\r\n/g, '\n');

            // Pause Markers - Syntax: [p|tabletPC|mobile|]
            contentHtml = contentHtml.replace(/\[p\|(\d*)(?:\|(\d*))?\|?\]/g, (match, d1, d2) => {
                const delayTabletPC = d1 ? parseInt(d1) : 0;
                const delayMobile = d2 ? parseInt(d2) : delayTabletPC;

                return `<div class="pause-trigger" 
                    data-delay="${delayTabletPC}" 
                    data-delay-mobile="${delayMobile}" 
                    style="height: 1px; width: 100%; opacity: 0; pointer-events: none; margin: 0;"></div>`;
            });

            contentHtml = contentHtml.replace(/\[\|(\d*)(?:\|(\d*))?(?:\|(\d*))?\|?\]/g, '');
            contentHtml = contentHtml.replace(/\[\.\|(\d*)(?:\|(\d*))?(?:\|(\d*))?\|?\.\]/g, '');

            // --- Tabs / Solo ---
            const tabsDiv = document.getElementById('view-tabs');
            const toggleContainer = document.getElementById('cifra-mode-toggle');

            if (data.tabs && data.tabs.trim()) {
                tabsDiv.innerText = data.tabs;
                toggleContainer.style.display = 'flex';
                app.setContentView('lyrics'); // Default
            } else {
                toggleContainer.style.display = 'none';
                app.setContentView('lyrics');
            }

            // Standard Chord Replacement (Regex) - Reverting Smart Logic
            contentHtml = contentHtml.replace(/\[([^\]]+)\]/g, (match, chordName) => {
                if (chordName.startsWith('|') || chordName.startsWith('.')) return match;
                const cleanName = chordName.replace(/[\[\]\*]/g, '');

                const openB = '<span class="chord-bracket">[</span>';
                const closeB = '<span class="chord-bracket">]</span>';

                if (app.isActualChord(cleanName)) {
                    return `${openB}<b class="interactive-chord" onclick="app.highlightChord('${cleanName}')">${cleanName}</b>${closeB}`;
                } else {
                    return `${openB}<b class="section-marker">${cleanName}</b>${closeB}`;
                }
            });

            const contentDiv = document.getElementById('view-content');
            contentDiv.innerHTML = contentHtml;

            // --- Strumming ---
            const strumContainer = document.getElementById('view-strumming-container');
            const strumDisplay = document.getElementById('view-strumming');

            if (data.strumming) {
                strumContainer.style.display = 'block';
                strumDisplay.innerHTML = app.renderStrumming(data.strumming);
            } else {
                strumContainer.style.display = 'none';
            }

            // --- Chord Gallery ---
            const chordsContainer = document.getElementById('view-chords-container');
            const chordsList = document.getElementById('view-chords-list');

            const chordRegex = /\[(.*?)\]/g;
            const foundChords = new Set();
            let match;
            while ((match = chordRegex.exec(data.content)) !== null) {
                const name = match[1];
                if (app.isActualChord(name)) {
                    foundChords.add(name);
                }
            }

            if (foundChords.size > 0) {
                chordsContainer.style.display = 'block';
                chordsList.innerHTML = '';
                foundChords.forEach(chordName => {
                    const card = app.createChordCard(chordName, false);
                    if (card) {
                        chordsList.appendChild(card);
                    }
                });
            } else {
                chordsContainer.style.display = 'none';
            }

            // Show Actions only if logged in
            // Actions are now in the header, handled by renderHeader call in navigate
            // But we might need to re-render header here if we want to be sure? 
            // Actually navigate calls renderHeader('cifra'), which checks app.state.user. 
            // So it should be fine.
            app.renderHeader('cifra'); // Re-run to ensure buttons appear if state matches

        } catch (e) {
            console.error(e);
            alert('Erro ao carregar cifra do Firebase');
        }
    },

    startMetronome: () => {
        const bpm = app.state.metronome.bpm;
        if (!bpm || bpm <= 0) return;

        app.stopMetronome();
        const ms = (60 / bpm) * 1000;
        const dot = document.getElementById('metronome-dot');

        app.state.metronome.active = true;
        app.state.metronome.interval = setInterval(() => {
            if (dot) {
                dot.style.background = 'var(--primary-color)';
                dot.style.transform = 'scale(1.3)';
                setTimeout(() => {
                    dot.style.background = 'var(--text-muted)';
                    dot.style.transform = 'scale(1)';
                }, 100);
            }
        }, ms);
    },

    stopMetronome: () => {
        if (app.state.metronome.interval) {
            clearInterval(app.state.metronome.interval);
            app.state.metronome.interval = null;
        }
        app.state.metronome.active = false;
    },



    autoWrapChords: () => {
        const textarea = document.getElementById('edit-content');
        if (!textarea) return;

        const content = textarea.value;
        const lines = content.split('\n');

        // Inclui suporte a: +, -, (), º, acidentes no baixo, extensões numéricas.
        const chordPattern = /\b([A-G][b#]?(?:maj|min|m|M|aug|dim|sus|add)?\d*[\+\-]?º?(?:[b#]\d*)?(?:\([^)]+\))?(?:\/[A-G][b#]?[\+\-]?\d*)?)(?=\s|$)/g;

        const newLines = lines.map(line => {
            // Se a linha for apenas uma marcação de seção completa (ex: "[Intro]"), ignora
            if (/^\[[^\]]+\]$/.test(line.trim())) return line;

            const words = line.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) return line;

            // Busca matches de acordes usando a nova regex
            const matches = [...line.matchAll(chordPattern)];

            // --- Heurística para evitar identificar acordes dentro de letras ---
            // 1. Se houver palavras longas (>3 caracteres) que NÃO são acordes, provavelmente é letra.
            const hasLongLyricWords = words.some(w => w.length > 3 && !w.match(chordPattern));
            if (hasLongLyricWords) return line;

            // 2. Se a proporção de acordes for muito baixa, provavelmente é letra
            // (Ex: "E você se foi" -> 1 match "E" em 4 palavras = 0.25)
            const ratio = matches.length / words.length;
            if (ratio < 0.5 && words.length > 1) return line;

            // Critério: se houver acordes identificados
            if (matches.length > 0) {
                // Se a linha tiver colchetes (ex: "[Intro:] G D"), precisamos ser cuidadosos
                // Substituir apenas o que NÃO está entre colchetes
                let result = line;
                // Uma estratégia simples: substituir os matches que não estão dentro de [ ]
                const matchesToWrap = matches.filter(m => {
                    const index = m.index;
                    const before = line.substring(0, index);
                    const openBrackets = (before.match(/\[/g) || []).length;
                    const closeBrackets = (before.match(/\]/g) || []).length;
                    return openBrackets === closeBrackets; // Está fora de colchetes
                });

                if (matchesToWrap.length > 0) {
                    // Substituir do fim para o começo para manter os índices
                    for (let i = matchesToWrap.length - 1; i >= 0; i--) {
                        const m = matchesToWrap[i];
                        result = result.substring(0, m.index) + `[${m[0]}]` + result.substring(m.index + m[0].length);
                    }
                    return result;
                }
            }

            return line;
        });

        textarea.value = newLines.join('\n');
        app.showToast('Acordes identificados e formatados! ✨');
        app.updateEditorPreview();
    },

    saveCifra: async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        // Handle checkbox manual (FormData behavior with unchecked boxes varies or just needs explicit handling)
        data.ready = document.getElementById('edit-ready').checked;

        // Ensure proper types
        if (data.scrollSpeed) data.scrollSpeed = parseInt(data.scrollSpeed);
        if (data.scrollSpeedMobile) data.scrollSpeedMobile = parseInt(data.scrollSpeedMobile);
        if (data.bpm) data.bpm = parseInt(data.bpm);
        else data.bpm = null;

        const id = data.id; // Empty only if new

        // Remove ID from payload to avoid storing it inside the doc redundantly (optional)
        delete data.id;

        // Add timestamp
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        try {
            if (id) {
                // UPDATE
                await app.db.collection('cifras').doc(id).update(data);
                app.navigate('cifra', id);
            } else {
                // CREATE
                const docRef = await app.db.collection('cifras').add(data);
                app.navigate('cifra', docRef.id);
            }
        } catch (e) {
            console.error(e);
            app.modal({ title: 'Erro', content: 'Erro ao salvar no Firebase. Verifique sua conexão.', confirmText: 'OK', cancelText: null });
        }
    },

    deleteCurrent: async () => {
        const res = await app.modal({
            title: 'Excluir Cifra',
            content: 'Tem certeza? Isso apagará para TODOS os usuários.',
            confirmText: 'Excluir',
            cancelText: 'Cancelar'
        });
        if (!res) return;

        const id = app.state.currentCifra.id;
        try {
            await app.db.collection('cifras').doc(id).delete();
            app.navigate('home');
            app.showToast('Cifra excluída.');
        } catch (e) {
            app.modal({ title: 'Erro', content: 'Erro ao excluir do Firebase.', confirmText: 'OK', cancelText: null });
        }
    },

    // --- SETLISTS ---
    loadSetlists: async () => {
        if (!app.state.user) return;
        // Realtime listener handles data updates and calls renderSetlistsGrid
        app.renderSetlistsGrid();
    },

    renderSetlistsGrid: () => {
        const grid = document.getElementById('setlist-grid');
        if (!grid) return;

        if (app.state.setlists.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted)">Nenhum repertório criado ainda.</p>';
            return;
        }

        grid.innerHTML = app.state.setlists.map(s => `
            <div class="cifra-card" onclick="app.playSetlist('${s.id}')">
                <div class="cifra-title">${s.name}</div>
                <div class="cifra-artist">${s.songs ? s.songs.length : 0} músicas</div>
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem; position: relative; z-index: 2;">
                    <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-color: var(--primary-color); color: var(--primary-color);" onclick="event.stopPropagation(); app.openSetlist('${s.id}')">Organizar</button>
                    <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="event.stopPropagation(); app.deleteSetlist('${s.id}')">Excluir</button>
                </div>
                <img src="icons/repertorio.svg" class="genre-icon-bg">
            </div>
        `).join('');
    },

    promptCreateSetlist: async () => {
        const name = await app.modal({
            title: 'Novo Repertório',
            content: 'Digite o nome do novo repertório:',
            input: true,
            placeholder: 'Ex: Show de Sexta',
            confirmText: 'Criar',
            cancelText: 'Cancelar'
        });
        if (name && name.trim()) app.createSetlist(name.trim());
    },

    createSetlist: async (name) => {
        try {
            await app.db.collection('setlists').add({
                name: name,
                songs: [],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            app.loadSetlists();
        } catch (e) {
            alert('Erro ao criar repertório.');
        }
    },

    deleteSetlist: async (id) => {
        const res = await app.modal({
            title: 'Excluir Repertório',
            content: 'Tem certeza que deseja apagar este repertório?',
            confirmText: 'Excluir',
            cancelText: 'Cancelar'
        });
        if (!res) return;
        try {
            await app.db.collection('setlists').doc(id).delete();
            app.loadSetlists();
            app.showToast('Repertório removido.');
        } catch (e) {
            app.modal({ title: 'Erro', content: 'Erro ao excluir.', confirmText: 'OK', cancelText: null });
        }
    },

    addToSetlistPrompt: async (songId) => {
        if (!app.state.user) return;
        if (app.state.setlists.length === 0) {
            app.modal({ title: 'Atenção', content: 'Crie primeiro um repertório na tela de Repertórios.', confirmText: 'OK', cancelText: null });
            return;
        }

        const choices = app.state.setlists.map((s, i) => `<div style="padding:0.5rem; border-bottom:1px solid #eee; cursor:pointer;" onclick="window._modalResolve(${i})">${s.name}</div>`).join('');

        // We can't easily use the generic modal for listing yet without more config, 
        // but let's just use the generic input modal but inform how to use it
        const setlistNames = app.state.setlists.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
        const choice = await app.modal({
            title: 'Adicionar ao Repertório',
            content: `Escolha o número do repertório:\n\n${setlistNames}`,
            input: true,
            placeholder: 'Digite o número',
            confirmText: 'Adicionar',
            cancelText: 'Cancelar'
        });

        if (choice) {
            const index = parseInt(choice) - 1;
            if (app.state.setlists[index]) {
                app.addToSetlist(app.state.setlists[index].id, songId);
            }
        }
    },

    addToSetlist: async (setlistId, songId) => {
        try {
            const doc = await app.db.collection('setlists').doc(setlistId).get();
            const songs = doc.data().songs || [];
            if (!songs.includes(songId)) {
                songs.push(songId);
                await app.db.collection('setlists').doc(setlistId).update({
                    songs: songs,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                app.showToast('Música adicionada ao repertório!');
            } else {
                alert('Esta música já está neste repertório.');
            }
        } catch (e) {
            alert('Erro ao adicionar música.');
        }
    },

    playSetlist: async (id) => {
        const setlist = app.state.setlists.find(s => s.id === id);
        if (setlist && setlist.songs && setlist.songs.length > 0) {
            app.state.currentSetlist = setlist;
            app.state.currentSetlistIndex = 0;
            app.navigate('cifra', setlist.songs[0]);
        } else {
            app.modal({ title: 'Atenção', content: 'Este repertório está vazio. Adicione músicas para começar a tocar.', confirmText: 'OK', cancelText: null });
        }
    },

    openSetlist: async (id) => {
        const setlist = app.state.setlists.find(s => s.id === id);
        if (setlist) {
            app.state.currentSetlist = setlist;

            // Show reorder section
            const reorderSection = document.getElementById('reorder-section');
            const reorderList = document.getElementById('reorder-list');
            const reorderTitle = document.getElementById('reorder-title');

            reorderTitle.innerText = `Organizar: ${setlist.name}`;
            reorderSection.style.display = 'block';
            reorderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Load songs info
            reorderList.innerHTML = '<p>Carregando músicas...</p>';

            const songs = [];
            for (const songId of (setlist.songs || [])) {
                let c = app.state.cifras.find(x => x.id === songId);
                if (!c) {
                    const snap = await app.db.collection('cifras').doc(songId).get();
                    if (snap.exists) c = { id: snap.id, ...snap.data() };
                }
                if (c) songs.push(c);
            }

            if (songs.length === 0) {
                reorderList.innerHTML = '<p style="color:var(--text-muted)">Nenhuma música neste repertório.</p>';
            } else {
                reorderList.innerHTML = songs.map((s, i) => `
                    <div class="sortable-item">
                        <div style="flex:1; cursor:pointer;" onclick="app.navigate('cifra', '${s.id}'); app.state.currentSetlistIndex = ${i};">
                            <span style="font-weight:bold; color:var(--primary-color);">${i + 1}.</span> ${s.title}
                        </div>
                        <div class="sort-controls">
                            <button class="btn-sort" onclick="app.moveInSetlist(${i}, -1)" ${i === 0 ? 'disabled style="opacity:0.2"' : ''} title="Subir">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                            </button>
                            <button class="btn-sort" onclick="app.moveInSetlist(${i}, 1)" ${i === songs.length - 1 ? 'disabled style="opacity:0.2"' : ''} title="Descer">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <button class="btn-sort" style="color:var(--danger-color); margin-left: 0.5rem;" onclick="app.removeFromSetlist(${i})" title="Remover">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }
    },

    moveInSetlist: async (index, direction) => {
        const setlist = app.state.currentSetlist;
        if (!setlist) return;

        const songs = [...setlist.songs];
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= songs.length) return;

        // Swap
        [songs[index], songs[newIndex]] = [songs[newIndex], songs[index]];

        try {
            await app.db.collection('setlists').doc(setlist.id).update({
                songs: songs,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Update local state and refresh
            setlist.songs = songs;
            app.openSetlist(setlist.id);
            app.showToast('Ordem atualizada!');
        } catch (e) {
            alert('Erro ao reorganizar.');
        }
    },

    removeFromSetlist: async (index) => {
        const res = await app.modal({
            title: 'Remover música',
            content: 'Deseja remover esta música do repertório?',
            confirmText: 'Remover',
            cancelText: 'Cancelar'
        });
        if (!res) return;

        const setlist = app.state.currentSetlist;
        const songs = [...setlist.songs];
        songs.splice(index, 1);

        try {
            await app.db.collection('setlists').doc(setlist.id).update({
                songs: songs,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            setlist.songs = songs;
            app.openSetlist(setlist.id);
            app.showToast('Música removida.');
        } catch (e) {
            alert('Erro ao remover.');
        }
    },

    renderSetlistNavigator: () => {
        const nav = document.getElementById('setlist-navigator');
        if (!nav) return; // Important: Element might not be in DOM yet or for this view

        if (!app.state.currentSetlist) {
            nav.style.display = 'none';
            return;
        }
        nav.style.display = 'block';
        document.getElementById('setlist-name').innerText = app.state.currentSetlist.name;
        document.getElementById('setlist-pos').innerText = `${app.state.currentSetlistIndex + 1} de ${app.state.currentSetlist.songs.length}`;
    },

    nextInSetlist: () => {
        if (!app.state.currentSetlist) return;
        if (app.state.currentSetlistIndex < app.state.currentSetlist.songs.length - 1) {
            app.state.currentSetlistIndex++;
            app.navigate('cifra', app.state.currentSetlist.songs[app.state.currentSetlistIndex]);
        } else {
            app.showToast('Fim do repertório');
        }
    },

    prevInSetlist: () => {
        if (!app.state.currentSetlist) return;
        if (app.state.currentSetlistIndex > 0) {
            app.state.currentSetlistIndex--;
            app.navigate('cifra', app.state.currentSetlist.songs[app.state.currentSetlistIndex]);
        }
    },


    // --- HELPERS (Editor, Logic, Scroll) ---
    // Mantendo a lógica de UI existente, apenas adaptando para não usar 'this' se possível
    // Ou usar 'app' explicitamente.

    loadEditor: (cifra) => {
        // Populate inputs
        document.getElementById('edit-id').value = cifra.id;
        document.getElementById('edit-title').value = cifra.title;
        document.getElementById('edit-artist').value = cifra.artist;
        document.getElementById('edit-content').value = cifra.content;
        document.getElementById('edit-scrollSpeed').value = cifra.scrollSpeed || '';
        document.getElementById('edit-scrollSpeedMobile').value = cifra.scrollSpeedMobile || cifra.scrollSpeed || '';
        document.getElementById('edit-capo').value = cifra.capo || '';
        document.getElementById('edit-genre').value = cifra.genre || '';
        document.getElementById('edit-bpm').value = cifra.bpm || '';
        document.getElementById('edit-youtube').value = cifra.youtube || '';
        const strum = cifra.strumming || '';
        document.getElementById('edit-strumming').value = strum;
        document.getElementById('edit-ready').checked = !!cifra.ready;
        document.getElementById('edit-tabs').value = cifra.tabs || '';

        app.updateStrumPreview(strum);
        app.updateEditorChords();
        app.updateEditorPreview();
    },

    updateEditorChords: () => {
        const input = document.getElementById('edit-content');
        const chordsList = document.getElementById('edit-chords-list');
        const container = document.getElementById('edit-chords-container');
        if (!input || !chordsList || !container) return;

        const content = input.value;
        const chordRegex = /\[(.*?)\]/g;
        const foundChords = new Set();
        let match;
        while ((match = chordRegex.exec(content)) !== null) {
            const name = match[1];
            if (app.isActualChord(name)) {
                foundChords.add(name);
            }
        }

        if (foundChords.size > 0) {
            container.style.display = 'block';
            chordsList.innerHTML = '';
            foundChords.forEach(chordName => {
                const card = app.createChordCard(chordName, true);
                if (card) chordsList.appendChild(card);
            });
        } else {
            container.style.display = 'none';
        }
    },

    updateEditorPreview: () => {
        const input = document.getElementById('edit-content');
        const preview = document.getElementById('edit-preview');
        if (!input || !preview) return;

        app.updateEditorChords();

        let content = input.value;
        // Sanitizar
        content = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Pause Marker - Syntax: [p|tabletPC|mobile|]
        content = content.replace(/\[p\|(\d*)(?:\|(\d*))?\|?\]\n?/g, (match, d1, d2) => {
            const delayTabletPC = (d1 !== undefined && d1 !== '') ? parseInt(d1) : -1;
            const delayMobile = (d2 !== undefined && d2 !== '') ? parseInt(d2) : delayTabletPC;

            const deskTxt = delayTabletPC === -1 ? 'Imediato' : (delayTabletPC === 0 ? 'Desativado' : delayTabletPC + 's');
            return `<div style="border-top: 1px dashed #10b981; color:#10b981; font-size:0.75rem; padding: 1px 0; margin-bottom: 2px;">⏸ Pausa (${deskTxt})</div>`;
        });

        // Remove Loop Markers if present
        content = content.replace(/\[\|(\d*)(?:\|(\d*))?(?:\|(\d*))?\|?\]/g, '');
        content = content.replace(/\[\.\|(\d*)(?:\|(\d*))?(?:\|(\d*))?\|?\.\]/g, '');

        // Chords - Standard Regex (No Smart)
        const formatted = content.replace(/\[([^\]]+)\]/g, (match, chord) => {
            if (match.includes('Loop')) return match;
            if (match.includes('<')) return match; // Already processed
            const cleanName = chord.replace(/[\[\]\*]/g, '');

            const openB = '<span class="chord-bracket">[</span>';
            const closeB = '<span class="chord-bracket">]</span>';

            if (app.isActualChord(cleanName)) {
                return `${openB}<b class="interactive-chord" style="color:var(--chord-color); cursor:pointer;">${cleanName}</b>${closeB}`;
            } else {
                return `${openB}<b class="section-marker" style="color:var(--primary-color); font-weight:700;">${cleanName}</b>${closeB}`;
            }
        });

        preview.innerHTML = formatted;
    },

    syncEditorScroll: () => {
        const input = document.getElementById('edit-content');
        const preview = document.getElementById('edit-preview');
        if (!input || !preview) return;
        preview.scrollTop = input.scrollTop;
    },

    strumMapping: {
        'U': 'batida para cima.svg', 'D': 'batida para baixo.svg',
        'u': 'abafado para cima.svg', 'd': 'abafado para baixo.svg',
        'X': 'abafado.svg', 'C': 'batida circular.svg',
        '|': 'divider', ' ': 'space'
    },

    addStrum: (icon, char) => {
        const input = document.getElementById('edit-strumming');
        input.value += char;
        app.updateStrumPreview(input.value);
    },

    clearStrum: () => {
        const input = document.getElementById('edit-strumming');
        input.value = '';
        app.updateStrumPreview('');
    },

    updateStrumPreview: (strumString) => {
        const preview = document.getElementById('edit-strumming-preview');
        if (!strumString) {
            preview.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Toque nos botões acima para criar a batida...</span>';
            return;
        }
        preview.innerHTML = app.renderStrumming(strumString);
    },

    renderStrumming: (strumString) => {
        if (!strumString) return '';
        const chars = strumString.split('');
        return chars.map((c, index) => {
            const file = app.strumMapping[c];
            let content = '';
            if (file === 'divider') content = '<span class="strum-divider">|</span>';
            else if (file === 'space') content = '<span class="strum-space"></span>';
            else if (file) content = `<img src="icons/${file}" class="strum-icon">`;

            if (!content) return '';
            return `<span class="strum-item" onclick="app.removeStrum(${index})" title="Toque para apagar" style="cursor:pointer; display:flex; align-items:center;">${content}</span>`;
        }).join('');
    },

    setContentView: (mode) => {
        const lyricsView = document.getElementById('view-content');
        const tabsView = document.getElementById('view-tabs');
        const btnLyrics = document.getElementById('btn-mode-lyrics');
        const btnTabs = document.getElementById('btn-mode-tabs');

        const chordsContainer = document.getElementById('view-chords-container');
        const strumContainer = document.getElementById('view-strumming-container');

        if (mode === 'tabs') {
            lyricsView.classList.add('hidden');
            tabsView.classList.remove('hidden');
            btnTabs.classList.add('active');
            btnLyrics.classList.remove('active');

            if (chordsContainer) chordsContainer.style.opacity = '0.3';
            if (strumContainer) strumContainer.style.opacity = '0.3';
        } else {
            lyricsView.classList.remove('hidden');
            tabsView.classList.add('hidden');
            btnLyrics.classList.add('active');
            btnTabs.classList.remove('active');

            if (chordsContainer) chordsContainer.style.opacity = '1';
            if (strumContainer) strumContainer.style.opacity = '1';
        }
    },

    removeStrum: (index) => {
        const input = document.getElementById('edit-strumming');
        if (!input) return;
        const val = input.value;
        const newVal = val.slice(0, index) + val.slice(index + 1);
        input.value = newVal;
        app.updateStrumPreview(newVal);

        // Keep focus on preview if possible, unless empty
        const preview = document.getElementById('edit-strumming-preview');
        if (preview && newVal.length > 0) preview.focus();
    },

    handleStrumInput: (e) => {
        // Prevent default scrolling for Space
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            app.addStrum('SPACE', ' ');
            return;
        }

        if (e.key === 'Backspace') {
            e.preventDefault();
            const input = document.getElementById('edit-strumming');
            if (input && input.value.length > 0) {
                // Remove last char
                const newVal = input.value.slice(0, -1);
                input.value = newVal;
                app.updateStrumPreview(newVal);
            }
            return;
        }
    },

    editCurrent: () => {
        app.navigate('editor', app.state.currentCifra);
    },

    // --- CHORDS LIBRARY & SELECTOR ---
    createChordCard: (chordName, isEditable = false) => {
        const svg = Chords.render(chordName, 0);

        if (!svg) {
            // Placeholder para acorde não cadastrado
            const card = document.createElement('div');
            card.className = 'chord-card missing-chord';
            card.innerHTML = `
                <div class="chord-name" style="color:var(--text-muted)">${chordName}</div>
                <div class="chord-svg-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:120px; text-align:center; gap:8px;">
                    <div style="width:60px; height:70px; border:1px dashed var(--border-color); border-radius:4px; opacity:0.3; display:flex; align-items:center; justify-content:center;">
                         <span style="font-size:1.5rem; color:var(--border-color)">?</span>
                    </div>
                    ${isEditable ? `<button type="button" class="btn btn-outline" style="font-size:0.7rem; padding:4px 10px; height:auto; min-width:80px;" onclick="event.stopPropagation(); app.openChordCreator('${chordName.replace(/'/g, "\\'")}')">Cadastrar</button>` : ''}
                </div>
            `;
            return card;
        }

        const count = Chords.getVariationCount(chordName);
        const starsCount = chordName.split('*').length - 1;
        const card = document.createElement('div');
        card.className = 'chord-card';
        card.dataset.chord = chordName;
        card.dataset.index = starsCount;
        card.dataset.editable = isEditable;
        card.id = `card-${chordName.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const cleanName = chordName.replace(/\*+$/, '');

        let navHtml = '';
        if (isEditable && count > 1) {
            navHtml = `<div class="chord-nav">
                    <button type="button" class="chord-nav-btn" onclick="app.rotateChord('${chordName}', -1)">‹</button>
                    <button type="button" class="chord-nav-btn" onclick="app.rotateChord('${chordName}', 1)">›</button>
                </div>`;
        }

        // Botões de ação (apenas se logado e for modo editável)
        let actionsBtn = '';
        const defaultIndex = 0;
        if (app.state.user && isEditable) {
            actionsBtn = `
                <div class="chord-card-actions">
                    <button type="button" class="btn-chord-action" title="Editar Acorde/Variação" onclick="event.stopPropagation(); app.openChordCreator('${chordName.replace(/'/g, "\\'")}', ${defaultIndex})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button type="button" class="btn-chord-action btn-chord-delete" title="Excluir Acorde/Variação" onclick="event.stopPropagation(); app.confirmDeleteChord('${chordName}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="chord-name">${cleanName}</div>
            <div class="chord-svg-container">${svg}</div>
            ${navHtml}
            ${actionsBtn}
        `;
        return card;
    },

    confirmDeleteChord: async (chordName) => {
        const cardId = `card-${chordName.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const card = document.getElementById(cardId);
        const index = parseInt(card.dataset.index || 0);
        const variations = Chords.dict[chordName];
        const isArray = Array.isArray(variations);
        const count = variations ? (isArray ? variations.length : 1) : 0;

        let title = 'Excluir Acorde';
        const cleanName = chordName.replace(/\*+$/, '');
        let content = `Deseja excluir o acorde <strong>${cleanName}</strong>?`;

        if (count > 1) {
            title = 'Excluir Variação';
            content = `Deseja excluir esta variação (posição) do acorde <strong>${cleanName}</strong>? As outras variações deste acorde permanecerão salvas.`;
        }

        const res = await app.modal({
            title: title,
            content: content,
            confirmText: 'Confirmar Exclusão',
            cancelText: 'Cancelar'
        });

        if (res) {
            try {
                if (count > 1) {
                    const newVariations = isArray ? [...variations] : [variations];
                    newVariations.splice(index, 1);

                    if (newVariations.length === 0) {
                        delete Chords.dict[chordName];
                        await app.db.collection('custom_chords').doc(app.getChordId(chordName)).delete();
                    } else {
                        await app.db.collection('custom_chords').doc(app.getChordId(chordName)).set({
                            name: chordName,
                            variations: newVariations,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        Chords.dict[chordName] = newVariations;
                    }
                } else {
                    await app.db.collection('custom_chords').doc(app.getChordId(chordName)).delete();
                    delete Chords.dict[chordName];
                }

                app.showToast('Excluído com sucesso!');
                app.loadLibrary();
            } catch (e) {
                console.error(e);
                app.showToast('Erro ao excluir.');
            }
        }
    },

    rotateChord: (chordName, direction) => {
        const cardId = `card-${chordName.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const card = document.getElementById(cardId);
        if (!card) return;

        const isEditable = card.dataset.editable === 'true';
        const textarea = document.getElementById('edit-content');

        let index = parseInt(card.dataset.index || 0);
        const count = Chords.getVariationCount(chordName);
        const newIndex = (index + direction + count) % count;

        if (isEditable && textarea) {
            // Sincronizar com o texto: converter índice em asteriscos
            const baseName = chordName.replace(/\*+$/, '');
            let newChordName = baseName;
            for (let i = 0; i < newIndex; i++) newChordName += '*';

            // Escapar caracteres especiais para o Regex (como #, b, /)
            const escapedOld = chordName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('\\[' + escapedOld + '\\]', 'g');

            const oldContent = textarea.value;
            const newContent = oldContent.replace(regex, `[${newChordName}]`);

            if (oldContent !== newContent) {
                textarea.value = newContent;
                // O updateEditorPreview (chamado pelo oninput ou manualmente) vai cuidar de atualizar a UI
                app.updateEditorPreview();
                app.showToast(`Variação de ${baseName} atualizada na cifra!`);
                return; // Interrompe pois o updateEditorPreview já redesenhou tudo
            }
        }

        // Caso não seja editável ou falhe a sincronização, apenas atualiza o SVG localmente
        card.dataset.index = newIndex;
        const newSvg = Chords.render(chordName, newIndex);
        const svgContainer = card.querySelector('.chord-svg-container');
        if (svgContainer) svgContainer.innerHTML = newSvg;

        const editBtn = card.querySelector('.btn-chord-action[title*="Editar"]');
        if (editBtn && isEditable) {
            editBtn.setAttribute('onclick', `event.stopPropagation(); app.openChordCreator('${chordName.replace(/'/g, "\\'")}', ${newIndex})`);
        }
    },

    loadLibrary: () => {
        const container = document.getElementById('library-list');
        if (!container) return;
        container.innerHTML = '';
        Object.keys(Chords.dict).sort().forEach(chordName => {
            const card = app.createChordCard(chordName, true);
            if (card) {
                card.style.width = '160px';
                container.appendChild(card);
            }
        });
    },

    openChordSelector: () => {
        document.getElementById('chord-selector-modal').style.display = 'flex';
        app.renderChordBases();
    },

    closeChordSelector: () => {
        document.getElementById('chord-selector-modal').style.display = 'none';
    },

    renderChordBases: () => {
        const basesContainer = document.getElementById('chord-bases');
        basesContainer.innerHTML = '';
        const allChords = Object.keys(Chords.dict).sort();
        const roots = new Set(allChords.map(c => {
            if (c.length > 1 && (c[1] === '#' || c[1] === 'b')) return c.substring(0, 2);
            return c.substring(0, 1);
        }));
        roots.forEach(root => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.innerText = root;
            btn.style.minWidth = '40px';
            btn.onclick = () => app.renderChordVariationsForRoot(root);
            basesContainer.appendChild(btn);
        });
    },

    renderChordVariationsForRoot: (root) => {
        const container = document.getElementById('chord-variations');
        container.innerHTML = '';
        const allChords = Object.keys(Chords.dict).filter(c => c.startsWith(root));
        allChords.forEach(chordName => {
            const variations = Chords.dict[chordName];
            if (!Array.isArray(variations)) return;
            variations.forEach((v, index) => {
                const svg = Chords.render(chordName, index);
                let code = chordName;
                for (let i = 0; i < index; i++) code += '*';
                const card = document.createElement('div');
                card.className = 'chord-card';
                card.style.cursor = 'pointer';
                card.style.border = '1px solid var(--primary-color)';
                card.title = `Inserir [${code}]`;
                card.onclick = () => app.insertChordIntoEditor(code);
                card.innerHTML = `<div class="chord-name">${code}</div><div class="chord-svg-container">${svg}</div>`;
                container.appendChild(card);
            });
        });
    },

    insertChordIntoEditor: (code) => {
        const textarea = document.getElementById('edit-content');
        const textToInsert = `[${code}]`;
        if (textarea.selectionStart || textarea.selectionStart == '0') {
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, startPos) + textToInsert + textarea.value.substring(endPos, textarea.value.length);
            textarea.focus();
            textarea.selectionStart = startPos + textToInsert.length;
            textarea.selectionEnd = startPos + textToInsert.length;
        } else {
            textarea.value += textToInsert;
        }
        app.closeChordSelector();
    },

    highlightChord: (chordName) => {
        const cardId = `card-${chordName.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const card = document.getElementById(cardId);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            card.style.transition = 'all 0.3s';
            card.style.transform = 'scale(1.1)';
            card.style.boxShadow = '0 0 20px var(--primary-color)';
            card.style.borderColor = 'var(--primary-color)';

            setTimeout(() => {
                card.style.transform = 'scale(1)';
                card.style.boxShadow = 'var(--shadow-md)';
                card.style.borderColor = 'var(--border-color)';
            }, 1000);
        }
    },

    // --- AUTOSCROLL ---
    scrollState: {
        active: false,
        speed: 30,
        lastTime: 0,
        accumulator: 0
    },

    toggleScroll: () => {
        app.scrollState.active = !app.scrollState.active;
        const btn = document.getElementById('btn-scroll-toggle');
        const iconPlay = document.getElementById('icon-play');
        const iconPause = document.getElementById('icon-pause');
        if (app.scrollState.active) {
            app.scrollState.lastTime = performance.now();
            app.scrollState.accumulator = 0;
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
            btn.classList.add('btn-primary');

            // Auto-scroll to Strumming/Content if at top
            const diff = window.scrollY; // Current scroll
            if (diff < 300) { // Only if user is near the top
                setTimeout(() => {
                    const strum = document.getElementById('view-strumming-container');
                    const content = document.getElementById('view-content');
                    const target = (strum && strum.style.display !== 'none') ? strum : content;

                    if (target) {
                        // Scroll com offset para não colar no header
                        const headerHeight = document.querySelector('header').offsetHeight || 80;
                        const targetPos = target.offsetTop - headerHeight - 20;
                        window.scrollTo({ top: targetPos, behavior: 'auto' });
                    }
                }, 300); // Increased delay for mobile robustness
            }

            requestAnimationFrame(app.scrollLoop);
        } else {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            btn.classList.add('btn-primary');
            // Limpa countdown se existir
            if (app.scrollState.currentInterval) {
                clearInterval(app.scrollState.currentInterval);
                app.scrollState.currentInterval = null;
            }
            const div = document.getElementById('loop-countdown');
            if (div) div.style.display = 'none';
        }
    },

    scrollLoop: (currentTime) => {
        if (!app.scrollState.active) return;
        if (!app.state.currentCifra) return;
        let deltaTime = currentTime - app.scrollState.lastTime;
        if (deltaTime > 100) deltaTime = 100;
        app.scrollState.lastTime = currentTime;

        // Choose speed based on device width (600px matches checkLoop logic)
        const isMobile = window.innerWidth <= 600;
        const speedVal = isMobile
            ? (app.state.currentCifra.scrollSpeedMobile || app.state.currentCifra.scrollSpeed || 30)
            : (app.state.currentCifra.scrollSpeed || 30);

        const pixelsPerSecond = 1.2 + (speedVal * 0.8);
        const pixelsToScroll = (pixelsPerSecond * deltaTime) / 1000;
        app.scrollState.accumulator += pixelsToScroll;
        if (app.scrollState.accumulator >= 1) {
            const integers = Math.floor(app.scrollState.accumulator);
            window.scrollBy(0, integers);
            app.scrollState.accumulator -= integers;

            // Check if end of page reached
            if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 2)) {
                app.toggleScroll();
                return;
            }
        }
        app.checkTriggers();
        requestAnimationFrame(app.scrollLoop);
    },

    checkTriggers: () => {
        app.checkPause();
    },

    checkPause: () => {
        const pauses = document.querySelectorAll('.pause-trigger:not([data-executed="true"])');

        pauses.forEach(trigger => {
            const rect = trigger.getBoundingClientRect();
            // Trigger pause if it reaches middle of screen (or near it)
            const triggerPoint = window.innerHeight / 2;

            if (rect.top <= triggerPoint && rect.top > 0) {
                console.log('Detectada pausa no meio do scroll...');
                trigger.setAttribute('data-executed', 'true');

                const isMobile = window.innerWidth <= 600;

                const getDelay = (el) => {
                    if (isMobile) return parseInt(el.dataset.delayMobile || el.dataset.delay || -1);
                    return parseInt(el.dataset.delay || -1);
                };

                let delaySeconds = getDelay(trigger);

                if (delaySeconds <= 0) return;

                app.scrollState.active = false; // Pause
                app.startCountdown(delaySeconds, 'Pausado em', () => {
                    app.scrollState.active = true;
                    app.scrollState.lastTime = performance.now();
                    requestAnimationFrame(app.scrollLoop);
                });
            }
        });
    },

    startCountdown: (seconds, label, onComplete) => {
        const div = document.getElementById('loop-countdown');
        const span = document.getElementById('loop-seconds');
        if (!div || !span) return;

        let remaining = seconds;
        div.style.display = 'block';
        div.innerHTML = `${label} <span id="loop-seconds">${remaining}</span>s...`;

        const interval = setInterval(() => {
            remaining--;
            const s = document.getElementById('loop-seconds');
            if (s) s.innerText = remaining;

            if (remaining <= 0) {
                clearInterval(interval);
                div.style.display = 'none';
                if (onComplete) onComplete();
            }
        }, 1000);

        // Armazenar o intervalo para poder cancelar se o usuário parar o scroll manualmente
        app.scrollState.currentInterval = interval;
    },

    // --- CHORD CREATOR ---
    openChordCreator: async (prefilledName = '', editIndex = -1) => {
        let chordData = {
            name: prefilledName,
            p: [100, 100, 100, 100, 100, 100], // 100 = nada definido
            bar: 0,
            noBarLine: false
        };

        // Se estiver editando, carregar dados existentes
        if (editIndex !== -1 && Chords.dict[prefilledName]) {
            const variations = Chords.dict[prefilledName];
            const v = Array.isArray(variations) ? variations[editIndex] : variations;
            if (v) {
                // Converter p absoluta para p relativa ao grid (1-5)
                const bar = v.bar || 0;
                chordData.bar = bar;
                chordData.noBarLine = v.noBarLine || false;
                chordData.p = v.p.map(val => {
                    if (val <= 0) return val; // 0 ou -1
                    return val - (bar > 0 ? bar - 1 : 0);
                });
            }
        }

        const renderFretboard = (targetId) => {
            const container = document.getElementById(targetId);
            container.innerHTML = '';

            // Dimensões do Editor (1.5x o card original)
            const scale = 1.5;
            const w = 100 * scale;
            const h = 120 * scale;
            const m = 15 * scale;
            const sGap = 14 * scale;
            const fGap = 18 * scale;

            // Iniciar SVG
            let svgStr = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;

            // Nut
            const barVal = parseInt(document.getElementById('chord-bar')?.value || chordData.bar);
            const nutWidth = barVal > 0 ? 1 : 4;
            svgStr += `<line x1="${m}" y1="${m}" x2="${w - m}" y2="${m}" stroke="#4b5563" stroke-width="${nutWidth}"/>`;

            // Strings
            for (let i = 0; i < 6; i++) {
                const x = m + i * sGap;
                svgStr += `<line x1="${x}" y1="${m}" x2="${x}" y2="${h - m}" stroke="#9ca3af" stroke-width="1"/>`;
            }

            // Frets
            for (let i = 1; i <= 5; i++) {
                const y = m + i * fGap;
                svgStr += `<line x1="${m}" y1="${y}" x2="${w - m}" y2="${y}" stroke="#9ca3af" stroke-width="1"/>`;
            }

            // Status Row (O/X)
            chordData.p.forEach((fret, sIndex) => {
                const x = m + sIndex * sGap;
                if (fret === -1) {
                    svgStr += `<text x="${x}" y="${m - 7}" text-anchor="middle" fill="#ef4444" font-size="16" font-family="sans-serif">×</text>`;
                } else if (fret === 0) {
                    svgStr += `<circle cx="${x}" cy="${m - 10}" r="4.5" stroke="#059669" stroke-width="2" fill="none"/>`;
                }
            });

            // Barre (Pestana)
            const noBarLine = document.getElementById('chord-no-bar')?.checked;
            if (barVal > 0) {
                const y = m + (1 * fGap) - (fGap / 2);
                if (!noBarLine) {
                    svgStr += `<rect x="${m - 3}" y="${y - 6}" width="${w - 2 * m + 6}" height="12" rx="3" fill="#059669"/>`;
                }
                svgStr += `<text x="0" y="${y + 6}" fill="#4b5563" font-size="14" font-family="sans-serif" font-weight="bold">${barVal}ª</text>`;
            }

            // Fingers
            chordData.p.forEach((fret, sIndex) => {
                if (fret > 0 && fret <= 5) {
                    const x = m + sIndex * sGap;
                    const y = m + (fret * fGap) - (fGap / 2);
                    // Não desenha se houver pestana na casa 1 (simplificação visual do card), A MENOS que noBarLine esteja marcado
                    if (barVal > 0 && fret === 1 && !noBarLine) return;
                    svgStr += `<circle cx="${x}" cy="${y}" r="7.5" fill="#059669"/>`;
                }
            });

            svgStr += `</svg>`;

            const interactiveWrap = document.createElement('div');
            interactiveWrap.className = 'fretboard-interactive';
            interactiveWrap.innerHTML = svgStr;

            // Camada de Interatividade
            const layer = document.createElement('div');
            layer.className = 'interaction-layer';
            layer.style.width = w + 'px';
            layer.style.height = h + 'px';

            for (let fret = 0; fret <= 5; fret++) {
                for (let string = 0; string < 6; string++) {
                    const cell = document.createElement('div');
                    cell.className = 'interaction-cell';
                    cell.onclick = () => toggleFret(string, fret);
                    layer.appendChild(cell);
                }
            }
            interactiveWrap.appendChild(layer);
            container.appendChild(interactiveWrap);
        };

        const toggleFret = (string, fret) => {
            if (fret === 0) {
                // Ciclo: Nada -> Aberto (0) -> Abafado (-1)
                if (chordData.p[string] === 100) chordData.p[string] = 0;
                else if (chordData.p[string] === 0) chordData.p[string] = -1;
                else chordData.p[string] = 100;
            } else {
                chordData.p[string] = (chordData.p[string] === fret) ? 100 : fret;
            }
            renderFretboard('chord-creator-fretboard');
        };

        const contentHtml = `
            <div class="chord-editor-container">
                <input type="text" id="new-chord-name" class="modal-input" placeholder="Nome do Acorde (ex: G7M)" style="margin-bottom:0" value="${chordData.name}">
                <div id="chord-creator-fretboard"></div>
                <div class="editor-controls">
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <label style="margin:0">Casa da Pestana (0=sem):</label>
                            <input type="number" id="chord-bar" value="${chordData.bar}" min="0" max="15" style="width:60px; padding:5px; border-radius:4px; border:1px solid var(--border-color)">
                        </div>
                        <div style="display:flex; align-items:center; gap:10px; background: rgba(0,0,0,0.02); padding: 0.5rem; border-radius: 8px; border: 1px solid var(--border-color);">
                            <input type="checkbox" id="chord-no-bar" style="width: auto; margin: 0;" ${chordData.noBarLine ? 'checked' : ''}>
                            <label for="chord-no-bar" style="margin: 0; cursor: pointer; color: var(--text-color); font-size: 0.9rem;">
                                Apenas número da casa (sem linha da pestana)
                            </label>
                        </div>
                    </div>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-top: 10px;">Clique nas casas para colocar os dedos. Na primeira linha, alterne entre Aberta (O) e Abafada (X).</p>
                </div>
            </div>
        `;

        const modalPromise = app.modal({
            title: 'Criar Novo Acorde',
            content: contentHtml,
            confirmText: 'Gravar Acorde',
            cancelText: 'Cancelar'
        });

        // Initialize board immediately
        renderFretboard('chord-creator-fretboard');

        // Escuta mudanças nos controles para atualizar visual
        requestAnimationFrame(() => {
            const barInput = document.getElementById('chord-bar');
            const noBarCheck = document.getElementById('chord-no-bar');
            if (barInput) {
                barInput.oninput = () => {
                    chordData.bar = parseInt(barInput.value) || 0;
                    renderFretboard('chord-creator-fretboard');
                };
            }
            if (noBarCheck) {
                noBarCheck.onchange = () => {
                    renderFretboard('chord-creator-fretboard');
                };
            }
        });

        const res = await modalPromise;

        if (res) {
            const name = res.name || '';
            const bar = res.bar || 0;
            const noBarLine = res.noBar || false;

            if (!name) {
                app.showToast('Dê um nome ao acorde!');
                return;
            }

            // Normalizar p (100 -> -1)
            const finalP = chordData.p.map(v => (v === 100 || v === null) ? -1 : v);

            // Adjust P if bar > 0 (nossa renderização usa p absoluta, mas guarda relativa no dict)
            // Se bar for 3, e coloquei dedo na casa 2 do grid, a casa real é 3 + 2 - 1 = 4.
            const adjustedP = finalP.map(v => (v > 0) ? (v + (bar > 0 ? bar - 1 : 0)) : v);

            const newVariation = { p: adjustedP };

            if (bar > 0) {
                newVariation.bar = bar;
                newVariation.noBarLine = !!noBarLine; // Garante booleano explícito
            }

            try {
                // Check if exists
                let variations = Chords.dict[name] || [];
                if (!Array.isArray(variations)) variations = [variations];

                if (editIndex !== -1 && variations[editIndex]) {
                    // Substituir existente se estiver em modo edit
                    variations[editIndex] = newVariation;
                } else {
                    // Adicionar nova variação
                    variations.push(newVariation);
                }

                await app.db.collection('custom_chords').doc(app.getChordId(name)).set({
                    name: name,
                    variations: variations,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                Chords.dict[name] = variations;
                app.showToast('Acorde gravado com sucesso!');
                if (app.state.currentView === 'library') app.loadLibrary();
                if (app.state.currentView === 'cifra' && app.state.currentCifra) {
                    app.loadCifra(app.state.currentCifra.id);
                }
            } catch (e) {
                console.error(e);
                app.showToast('Erro ao salvar acorde.');
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', app.init);
