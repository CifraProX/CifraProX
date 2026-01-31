// DEBUG: Immediate execution verification
console.log('%c ========================================', 'background: lime; color: black; font-size: 16px; padding: 5px;');
console.log('%c APP_V2.JS LOADED!', 'background: lime; color: black; font-size: 20px; padding: 10px; font-weight: bold;');
console.log('%c ========================================', 'background: lime; color: black; font-size: 16px; padding: 5px;');


// Prevent redeclaration error - but ensure fresh initialization
window.app = {
    state: {
        user: null, // Default to null (Guest)
        currentCifra: null,
        cifras: [],
        setlists: [],
        currentSetlist: null,
        currentSetlistIndex: -1,
        unsubs: { cifras: null, setlists: null }, // Control for listeners
        metronome: { interval: null, bpm: 0, active: false },
        currentTranspose: 0
    },

    // --- CONFIGURAÇÃO LOCAL ---
    // --- CONFIGURAÇÃO LOCAL ---
    API_URL: window.location.origin, // Automático: usa o mesmo IP/Porta do acesso atual


    // Firebase Config (Restaurado)
    // Firebase Config (Corrigido)
    firebaseConfig: {
        apiKey: "AIzaSyDcx_MKD1ug5t_tEfyhYrmFkXBhlFssfyg",
        authDomain: "cifraprox-270126.firebaseapp.com",
        databaseURL: "https://cifraprox-270126-default-rtdb.firebaseio.com",
        projectId: "cifraprox-270126",
        storageBucket: "cifraprox-270126.firebasestorage.app",
        messagingSenderId: "901280078984",
        appId: "1:901280078984:web:6b1354ce044279c18e933d",
        databaseId: "cifraprox"
    },
    db: null,
    auth: null,

    init: async () => {
        try {
            console.log('%c [INIT] Iniciando app.init()...', 'background: blue; color: white; padding: 5px; font-weight: bold;');


            // Initialize Firebase
            if (!firebase.apps.length) {
                console.log('[INIT] Inicializando Firebase Core...');
                firebase.initializeApp(app.firebaseConfig);
            }

            // --- CONEXÃO COM BANCO NOMEADO (CIFRAPROX) ---
            console.log('[INIT] Verificando firestoreBridge...');

            // 1. Aguardar carregamento do Bridge (Timeout aumentado para 10s)
            let attempts = 0;
            const maxAttempts = 100; // 100 * 100ms = 10 segundos

            while (!window.firestoreBridge && !window.connectToNamedDB && attempts < maxAttempts) {
                if (attempts % 10 === 0) console.log(`[INIT] Aguardando Bridge... (${attempts}/${maxAttempts})`);
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }

            if (window.firestoreBridge || window.connectToNamedDB) {
                try {
                    console.log('[INIT] Bridge encontrada. Conectando...');

                    let namedDb;
                    // Support both V1 (connectToNamedDB) and V2 (firestoreBridge)
                    if (window.firestoreBridge && window.firestoreBridge.initDB) {
                        namedDb = window.firestoreBridge.initDB(app.firebaseConfig, 'cifraprox');
                    } else if (window.connectToNamedDB) {
                        namedDb = window.connectToNamedDB(app.firebaseConfig, 'cifraprox');
                    }

                    // 3. Shim/Adaptador
                    // app.db = firebase.firestore(); // DISABLED FOR TESTING (Context Isolation check)
                    // NOTE: Comentado para verificar se o bridge funciona de forma independente
                    app.db = firebase.firestore();

                    if (namedDb) {
                        app.namedDb = namedDb; // Store for Hybrid usage

                        // Sanity Check
                        const dbId = namedDb._databaseId ? namedDb._databaseId.database : (namedDb.databaseId || 'unknown');
                        console.log(`[INIT] Bridge Conectada! ID: ${dbId}`);

                        if (dbId === '(default)') {
                            console.warn("WARN: Bridge retornou banco Default! Verifique a configuração.");
                        }
                    } else {
                        throw new Error("Bridge retornou nulo! Abortando.");
                    }

                } catch (e) {
                    console.error(`[INIT] ERRO FATAL BRIDGE: ${e.message}`);
                    alert("FATAL BACKEND ERROR: " + e.message);
                    throw e; // Stop execution
                }
            } else {
                console.error("[INIT] FATAL: Bridge Timeout (Não carregou em 10s).");
                alert("ERRO CRÍTICO: O componente de conexão (Bridge) falhou.");
                throw new Error("Bridge Timeout");
            }

            app.auth = firebase.auth();
            console.log('[INIT] Firebase Auth pronto.');

            // Final check for Auth (ensure it's set)
            if (!app.auth) app.auth = firebase.auth();

            // Initialize Theme
            const savedTheme = localStorage.getItem('theme') || 'light';
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-mode');
                app.updateThemeIcons();
            }

            // Check User Session
            // Auth State Listener - UI Sync Only
            app.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('[AUTH STATE] Usuário logado:', user.uid);
                    // Sync State from LocalStorage if available (Optimistic)
                    // Note: Real user data loading should happen via loadHeader or separate listener
                } else {
                    console.log('[AUTH STATE] Usuário desconectado');
                    app.state.user = null;
                }

                // Force header update
                if (app.updateHeader) app.updateHeader();
            });
            console.log('[INIT] Verificando sessão local...');
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));

            if (token && user) {
                app.state.user = user;
                console.log(`[INIT] Usuário restaurado: ${user.email}`);
            } else {
                app.state.user = null;
                console.log('[INIT] Nenhum usuário logado (Guest).');
            }

            console.log('[INIT] Renderizando Header...');
            app.renderHeader(app.state.currentView);

            // Register Service Worker
            if ('serviceWorker' in navigator) {
                // Force update check by adding version param
                navigator.serviceWorker.register('sw.js?v=2').then(registration => {
                    registration.update();
                }).catch(err => console.warn('SW register fail:', err));
            }

            // Evento para botão voltar do navegador/celular
            window.onpopstate = (event) => {
                if (event.state && event.state.view) {
                    app.navigate(event.state.view, event.state.param, true);
                } else {
                    const hash = location.hash.substring(1);
                    if (hash) {
                        const [view, param] = hash.split('/');
                        app.navigate(view, param || null, true);
                    } else {
                        app.navigate('home', null, true);
                    }
                }
            };

            // Carregar cifras iniciais
            app.loadCifras();
            // Monitor de Rede (Offline)
            window.addEventListener('online', app.updateNetworkStatus);
            window.addEventListener('offline', app.updateNetworkStatus);
            app.updateNetworkStatus();

            // Setup inicial
            let view = location.hash ? location.hash.substring(1).split('/')[0] : '';
            const param = location.hash ? location.hash.substring(1).split('/')[1] : null;

            // Se não estiver logado, forçar tela de login
            if (!app.state.user) {
                view = 'login';
            } else if (!view) {
                // Redirecionar baseado no role do usuário
                if (app.state.user.role === 'school') {
                    view = 'school';
                } else if (app.state.user.role === 'admin') {
                    view = 'admin';
                } else {
                    view = 'home';
                }
            }

            // Fechar popover ao clicar fora
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.interactive-chord') && !e.target.closest('.chord-popover')) {
                    app.hideChordPopover();
                }
            });

            // Substitui o estado inicial
            history.replaceState({ view, param }, '', '#' + view);
            app.navigate(view, param, true);
        } catch (error) {
            document.body.innerHTML = `<div style="color:red; padding:20px;">ERRO FATAL: ${error.message}</div>`;
            console.error(error);
        }
    },

    debugApp: () => {
        console.log("=== DIAGNÓSTICO DO APP ===");
        console.log("1. Configuração Firebase:", app.firebaseConfig);
        console.log("2. Auth Compat (app.auth):", app.auth ? app.auth.currentUser : 'N/A');

        if (app.namedDb) {
            console.log("3. Banco NOMEADO (app.namedDb): CONECTADO");
            console.log("   - DB ID:", app.namedDb._databaseId ? app.namedDb._databaseId.database : 'unknown');
            console.log("   - App Name:", app.namedDb.app.name);
            if (window.firestoreBridge && window.firestoreBridge.utils) {
                const authMod = window.firestoreBridge.utils.getAuth(app.namedDb.app);
                console.log("   - Auth Modular (Linked):", authMod.currentUser);
            }
        } else {
            console.log("3. Banco NOMEADO: DESCONECTADO (!!!)");
        }

        console.log("4. User State (app.state.user):", app.state.user);
        console.log("5. LocalStorage Token:", localStorage.getItem('token'));
        console.log("============================");
    },

    navigate: async (view, param = null, addToHistory = true) => {
        // --- SECURITY GUARD ---
        const role = app.state.user ? app.state.user.role : 'guest';

        console.log('[NAVIGATE DEBUG] View solicitada:', view, '| Role:', role);

        // 1. School Access Logic
        if (role === 'school') {
            console.log('[NAVIGATE DEBUG] Usuário é SCHOOL');
            if (view !== 'school' && view !== 'login') {
                console.log('[NAVIGATE DEBUG] Forçando redirecionamento para school');
                view = 'school'; // Force redirect to school dashboard
            }
        } else {
            // 2. Prevent non-schools from accessing school dashboard
            if (view === 'school') {
                console.log('[NAVIGATE DEBUG] Não-school tentando acessar school - bloqueado');
                app.showToast('Acesso negado.');
                view = 'home';
            }
        }

        // 3. Prevent Students from accessing Admin
        if (view === 'admin' && role !== 'admin') {
            view = 'home';
        }

        app.state.currentView = view;
        if (addToHistory) {
            history.pushState({ view, param }, '', `#${view}${param ? '/' + param : ''}`);
        }

        const main = document.getElementById('app');
        main.innerHTML = '';

        let templateId = `view-${view}`;
        const template = document.getElementById(templateId);

        console.log('[NAVIGATE DEBUG] Buscando template:', templateId, '| Encontrado:', !!template);

        if (!template) {
            console.error('[NAVIGATE DEBUG] Template não encontrado:', templateId);
            main.innerHTML = '<div class="flex items-center justify-center h-screen text-red-500">Erro: View não encontrada (' + templateId + ')</div>';
            return;
        }

        const clone = template.content.cloneNode(true);
        main.appendChild(clone);
        console.log('[NAVIGATE DEBUG] Template carregado com sucesso');

        // Header Updates (Nome do Usuário)
        if (app.state.user) {
            const userDisplay = document.getElementById('header-username');
            if (userDisplay) {
                const name = app.state.user.email.split('@')[0];
                userDisplay.textContent = name.charAt(0).toUpperCase() + name.slice(1);
            }
            // Iniciais no avatar
            const avatar = document.querySelector('.h-10.w-10.rounded-full.bg-primary');
            if (avatar) {
                const name = app.state.user.email.split('@')[0];
                avatar.innerText = name.substring(0, 2).toUpperCase();
            }

            // Show Admin Link
            if (app.state.user.role === 'admin') {
                const adminContainer = document.getElementById('admin-link-container');
                if (adminContainer) adminContainer.classList.remove('hidden');
            }
        }

        // Theme Icon Update
        app.updateThemeIcons();

        // View Specific Logic
        if (view === 'home') {
            app.loadCifras();
        } else if (view === 'editor') {
            if (param) app.loadEditor(param);
        } else if (view === 'cifra') {
            app.loadCifra(param);
        } else if (view === 'admin') {
            app.loadAdminUsers();
        } else if (view === 'school') {
            console.log('[NAVIGATE DEBUG] Chamando loadSchoolDashboard()');
            app.loadSchoolDashboard();
        } else if (view === 'classroom') {
            // Setup classroom (Timer or Init)
        }
    },

    toggleTheme: () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
        app.updateThemeIcons();
    },

    updateThemeIcons: () => {
        const html = document.documentElement;
        const isDark = html.classList.contains('dark');
        const icons = document.querySelectorAll('.theme-icon'); // Usando classe comum agora
        icons.forEach(icon => {
            icon.textContent = isDark ? 'light_mode' : 'dark_mode';
        });
    },

    extractYouTubeId: (url) => {
        if (!url) return null;
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    },

    toggleMusicPlayer: (forceState = null, source = 'original') => {
        const modal = document.getElementById('music-player-modal');
        const container = document.getElementById('music-player-container');
        const titleSpan = document.getElementById('player-song-title');
        const statusSpan = document.getElementById('player-status');

        const newState = forceState !== null ? forceState : (modal.style.display === 'none');
        app.musicPlayerActive = newState;

        if (newState) {
            const url = source === 'training' ? app.state.currentCifra?.youtubeTraining : app.state.currentCifra?.youtube;
            const id = app.extractYouTubeId(url);
            if (!id) {
                app.showToast('Link do YouTube inválido.');
                return;
            }
            titleSpan.innerText = app.state.currentCifra.title;
            statusSpan.innerText = source === 'training' ? 'Vídeo de Treino' : 'Tocando agora';
            statusSpan.style.color = source === 'training' ? '#10b981' : 'var(--primary-color)';

            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('active'));

            const isLocalFile = window.location.protocol === 'file:';
            const origin = isLocalFile ? null : window.location.origin;

            // Se o player já existe, verificar se o container na tela é o novo DIV (resetado pela navegação)
            // A API do YouTube substitui o DIV por um IFRAME. Se for DIV, o player é "stale" (velho).
            const isStale = app.ytPlayer && container && container.tagName === 'DIV';

            if (isStale) {
                try { app.ytPlayer.destroy(); } catch (e) { }
                app.ytPlayer = null;
            }

            // Se o player já existe e é válido, apenas carregar novo vídeo
            if (app.ytPlayer && typeof app.ytPlayer.loadVideoById === 'function') {
                app.ytPlayer.loadVideoById(id);
            } else {
                // Criar player usando a API oficial
                if (typeof YT !== 'undefined' && YT.Player) {
                    app.ytPlayer = new YT.Player('music-player-container', {
                        height: '157',
                        width: '280',
                        host: 'https://www.youtube.com',
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
                    container.innerHTML = `<iframe width="280" height="157" src="https://www.youtube.com/embed/${id}?autoplay=1${originParam}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
                }
            }
        } else {
            modal.classList.remove('active');

            // Pausar e limpar o player para evitar bugs de estado
            if (app.ytPlayer && typeof app.ytPlayer.pauseVideo === 'function') {
                app.ytPlayer.pauseVideo();
            }

            setTimeout(() => {
                modal.style.display = 'none';
                // SEMPRE destruir o player se ele for iframe (fallback) ou se quisermos garantir limpeza total
                if (!app.ytPlayer) {
                    container.innerHTML = '<div id="music-player-container"></div>';
                } else {
                    // Opcional: Para máxima robustez em SPAs, podemos destruir no fechar
                    // Mas vamos manter a tentativa de reuso se o elemento ainda existir.
                    // Se o usuário fechar o modal e trocar de música (navigate), o navigate já limpa o app.ytPlayer.
                }
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
        // Deprecated: Header is rendered by Templates now.
    },

    // register: async (e) => { ... } // Duplicate function removed


    login: async (e) => {
        if (e) e.preventDefault();

        const emailEl = document.getElementById('email');
        const passEl = document.getElementById('password');
        // Find button in the form
        const btn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;

        if (!emailEl || !passEl) return;
        const email = emailEl.value.trim();
        const password = passEl.value;

        if (!email || !password) {
            app.showToast('Preencha email e senha.');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons-round animate-spin text-sm">refresh</span> Entrando...';
        }

        try {
            // 1. Firebase Auth
            const userCredential = await app.auth.signInWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            // 2. Fetch User Profile from Firestore
            let userData;
            let userRole = 'student';

            // HYBRID: Use Modular DB if available (cifraprox), else ABORT
            // HYBRID: Use Modular DB if available (cifraprox), else ABORT
            if (app.namedDb && window.firestoreBridge && window.firestoreBridge.utils) {
                console.log("%c [LOGIN] Usando Banco NOMEADO (Hybrid) ", "background: #059669; color: white; padding: 4px;");
                const { doc, getDoc, setDoc } = window.firestoreBridge.utils;
                const userRef = doc(app.namedDb, 'users', uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    console.warn('Perfil não encontrado (Named DB). Criando perfil automaticamente...');
                    userData = {
                        email: email,
                        name: email.split('@')[0],
                        role: email === 'cifraprox@gmail.com' ? 'admin' : 'student',
                        plan_id: 1,
                        createdAt: new Date().toISOString(), // Valid for both SDKs (string)
                        status: 'active'
                    };
                    await setDoc(userRef, userData);
                } else {
                    userData = userSnap.data();
                }
            } else {
                // STRICT MODE: NO FALLBACK
                throw new Error("ERRO CRÍTICO: Conexão com banco 'cifraprox' perdida no Login. Abortando para segurança.");
            }

            // 3. Update Session
            const user = {
                id: uid,
                email: userData.email,
                role: userData.role || 'student',
                plan_id: userData.plan_id || 1,
                name: userData.name || 'Usuário'
            };

            app.state.user = user;
            localStorage.setItem('token', 'firebase-session');
            localStorage.setItem('user', JSON.stringify(user));

            app.showToast(`Bem-vindo, ${user.name}!`);

            // 4. Redirect
            if (user.role === 'admin') app.navigate('admin');
            else if (user.role === 'school') app.navigate('school');
            else app.navigate('home');

        } catch (error) {
            console.error(error);
            let msg = 'Erro ao fazer login.';
            if (error.code === 'auth/wrong-password') msg = 'Senha incorreta.';
            else if (error.code === 'auth/user-not-found') msg = 'Usuário não encontrado.';
            else if (error.code === 'auth/invalid-email') msg = 'Email inválido.';
            app.showToast(msg);

            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Entrar na conta';
            }
        }
    },

    logout: async () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        app.state.user = null;
        app.navigate('login');
    },

    slugify: (text) => {
        return text.toString().toLowerCase().trim()
            .replace(/&/g, 'e') // Especial para Cifra Club (Henrique & Juliano -> henrique-e-juliano)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^\w\s-]/g, '') // Remove caracteres especiais restantes
            .replace(/[\s_-]+/g, '-') // Espaços para -
            .replace(/^-+|-+$/g, ''); // Limpa bordas
    },

    importFromCifraClub: async () => {
        const titleInput = document.getElementById('edit-title');
        const artistInput = document.getElementById('edit-artist');
        const title = titleInput.value.trim();
        const artist = artistInput.value.trim();

        if (!title || !artist) {
            app.showToast('Preencha o Título e o Artista primeiro.');
            return;
        }

        const btn = document.querySelector('button[onclick="app.importFromCifraClub()"]');
        const originalText = btn.innerText;
        btn.innerText = '⌛ Buscando...';
        btn.disabled = true;

        try {
            // --- 0. Verificar se a música já existe na biblioteca ---
            const snapDup = await app.db.collection('cifras').where('title', '==', title).get();

            let isDuplicate = false;
            if (!snapDup.empty) {
                // Check artist manually (Firestore where is exact, but let's be safe)
                snapDup.forEach(doc => {
                    const cifra = doc.data();
                    if (cifra.artist === artist) isDuplicate = true;
                });
            }

            if (isDuplicate && !document.getElementById('edit-id').value) {
                const proceed = confirm(`A música "${title}" de "${artist}" já existe na sua biblioteca. Deseja importar e sobrescrever o conteúdo atual do editor?`);
                if (!proceed) {
                    btn.innerText = originalText;
                    btn.disabled = false;
                    return;
                }
            }

            const artSlug = app.slugify(artist);
            const musSlug = app.slugify(title);
            const url = `https://www.cifraclub.com.br/${artSlug}/${musSlug}/`;

            // Proxy AllOrigins para evitar CORS
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

            const response = await fetch(proxyUrl);

            if (!response.ok) throw new Error('Serviço de busca indisponível no momento.');

            const textResponse = await response.text();
            let data;

            try {
                data = JSON.parse(textResponse);
            } catch (err) {
                if (textResponse.includes('Oops') || textResponse.includes('404')) {
                    throw new Error('Música não encontrada. Verifique se o nome do artista e da música estão corretos no Cifra Club.');
                }
                throw new Error('Resposta inválida do servidor de busca.');
            }

            if (!data || !data.contents) {
                throw new Error('Conteúdo não encontrado. Pode ser que a URL gerada esteja incorreta.');
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            // Cifra Club costuma usar <pre> ou .cifra_cnt
            let contentEl = doc.querySelector('pre') || doc.querySelector('.cifra_cnt');

            if (!contentEl) {
                throw new Error('Cifra não encontrada. Verifique se o nome está exato.');
            }

            // Converter <b>Acorde</b> para [Acorde]
            let rawHtml = contentEl.innerHTML;
            rawHtml = rawHtml.replace(/<a[^>]*>|<\/a>/g, '');
            let formatted = rawHtml.replace(/<b>(.*?)<\/b>/g, '[$1]');

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formatted;
            let finalContent = tempDiv.innerText;

            // --- Tentar capturar Tom e Capo do Cifra Club ---
            const tomEl = doc.getElementById('cifra_tom');

            let finalTom = "";
            let originalTom = "";

            if (tomEl) {
                // Pega apenas o que está em destaque (b ou a), ignorando o resto
                const specificTom = tomEl.querySelector('b') || tomEl.querySelector('a') || tomEl;
                originalTom = specificTom.innerText.trim();
                finalTom = originalTom;
            }

            // AUTO-TRANSPOSE: Se o usuário já tinha definido um tom no input, RESPEITAR
            const currentTomInput = document.getElementById('edit-tom');
            if (currentTomInput && currentTomInput.value.trim() !== "") {
                const requestedTom = currentTomInput.value.trim();

                // Se o tom solicitado for válido e diferente do original
                if (originalTom && app.isActualChord(requestedTom) && app.isActualChord(originalTom)) {
                    if (originalTom !== requestedTom) {
                        console.log(`[IMPORT] Auto-Transposing: ${originalTom} -> ${requestedTom}`);
                        const semitones = Transposer.getSemitonesBetween(originalTom, requestedTom);
                        if (semitones !== 0) {
                            finalContent = Transposer.transposeSong(finalContent, semitones);
                            finalTom = requestedTom;
                            app.showToast(`Cifra transposta automaticamente para ${requestedTom}`);
                        }
                    }
                } else if (!originalTom && app.isActualChord(requestedTom)) {
                    // Se não detectou tom original, assume o solicitado mas não transpõe (arriscado, melhor avisar)
                    finalTom = requestedTom;
                }
            }

            if (document.getElementById('edit-tom')) {
                document.getElementById('edit-tom').value = finalTom;
            }

            // Melhoria na detecção do Capo
            let capoVal = null;
            const capoMatch = data.contents.match(/capo:\s*(\d+)/i);
            if (capoMatch) capoVal = capoMatch[1];

            if (!capoVal) {
                const capoEl = doc.getElementById('cifra_capo') || doc.querySelector('.js-capo-value');
                if (capoEl) {
                    const match = capoEl.innerText.match(/(\d+)/);
                    if (match) capoVal = match[1];
                }
            }

            if (capoVal && document.getElementById('edit-capo')) {
                const select = document.getElementById('edit-capo');
                const targetValue = capoVal + "ª Casa";
                select.value = targetValue;

                // Fallback se não bater exatamente com o value
                if (select.selectedIndex === -1) {
                    const options = Array.from(select.options);
                    const matched = options.find(o => o.value.includes(capoVal) || o.text.includes(capoVal));
                    if (matched) select.value = matched.value;
                }
            }

            // Separar Tablaturas (Solo/Riff) da Letra (Usando buffer para preservar espaços)
            const lines = finalContent.split('\n');
            let mainLines = [];
            let tabLines = [];
            let emptyBuffer = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineTrim = line.trim();

                if (lineTrim === "") {
                    emptyBuffer.push(line);
                    continue;
                }

                const nextLine = lines[i + 1] || "";
                const nextNextLine = lines[i + 2] || "";

                // É uma linha de tabulação real? (ex: |--- ou hífens longos)
                const isTabLine = /[a-zA-Z]?\|-/.test(line) || /-[-|0-9]{8,}/.test(line);

                // É um cabeçalho informativo de tab? 
                const tabKeywords = /tab|solo|dedilhado|riff|baixo|intro/i;
                const isTabHeading = (lineTrim.startsWith('[') && tabKeywords.test(lineTrim)) || (lineTrim.endsWith(':') && tabKeywords.test(lineTrim));

                // Se é um cabeçalho e as próximas linhas são tab
                const isHeadingForTab = isTabHeading && (
                    /[a-zA-Z]?\|-/.test(nextLine) || /-[-|0-9]{8,}/.test(nextLine) ||
                    /[a-zA-Z]?\|-/.test(nextNextLine) || /-[-|0-9]{8,}/.test(nextNextLine)
                );

                if (isTabLine || isHeadingForTab) {
                    tabLines.push(...emptyBuffer);

                    // Adicionar a linha
                    tabLines.push(line);

                    // Se for cabeçalho e a próxima linha NÃO for vazia, força um espaço para estética
                    if (isHeadingForTab && nextLine.trim() !== "") {
                        tabLines.push("");
                    }

                    emptyBuffer = [];
                } else {
                    mainLines.push(...emptyBuffer);
                    mainLines.push(line);
                    emptyBuffer = [];
                }
            }
            // Limpa buffer restante
            mainLines.push(...emptyBuffer);

            const cleanMain = "[p|0|0|]\n\n" + mainLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            const cleanTabs = tabLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

            // Preencher Editor
            const textarea = document.getElementById('edit-content');
            const tabArea = document.getElementById('edit-tabs');

            textarea.value = cleanMain;
            if (tabArea) tabArea.value = cleanTabs;

            // Scroll to top of textarea and trigger preview
            textarea.scrollTop = 0;
            app.updateEditorPreview();

        } catch (e) {
            console.error('Erro na importação:', e);
            alert('Erro ao importar: ' + e.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },



    saveCifra: async (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.id.value;

        const payload = {
            title: form.title.value,
            artist: form.artist.value,
            content: form.content.value,
            tabs: form.tabs.value || '',
            tone: form.tom.value || '',
            capo: form.capo.value || '',
            genre: form.genre.value || '',
            bpm: form.bpm.value || '',
            youtube: form.youtube.value || '',
            youtubeTraining: form.youtubeTraining.value || '',
            ready: form.ready.checked,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // HYBRID: Use Modular DB if available
            // HYBRID: Use Modular DB if available
            if (app.namedDb && window.firestoreBridge && window.firestoreBridge.utils) {
                const { doc, addDoc, updateDoc, collection } = window.firestoreBridge.utils;
                console.log("%c [SAVE] Usando Banco NOMEADO (Hybrid)", "background: #059669; color: white;");

                payload.updatedAt = new Date().toISOString(); // Simple timestamp

                if (id) {
                    // UPDATE
                    const docRef = doc(app.namedDb, 'cifras', id);
                    await updateDoc(docRef, payload);
                } else {
                    // CREATE
                    payload.createdAt = new Date().toISOString();
                    const colRef = collection(app.namedDb, 'cifras');
                    await addDoc(colRef, payload);
                }
            } else {
                // STRICT MODE: NO FALLBACK
                throw new Error("ERRO CRÍTICO: Conexão com banco 'cifraprox' perdida ao Salvar Cifra. Abortando.");
            }

            app.showToast('Cifra salva no Firestore!');
            app.navigate('home');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar cifra: ' + error.message);
        }
    },

    // Métodos removidos (Realtime e LoadCustom)
    initRealtimeListeners: () => { },
    stopRealtimeListeners: () => { },
    loadCustomChords: async () => { },


    // --- ADMIN MODULE ---
    loadAdminUsers: () => {
        const area = document.getElementById('admin-users-list');
        const countTotal = document.getElementById('stat-total-users');
        const countActive = document.getElementById('stat-active-users');
        const countSuspended = document.getElementById('stat-suspended-users');

        if (!area) return;

        area.innerHTML = '<tr><td colspan="6" class="p-4 text-center">Carregando Firebase...</td></tr>';

        // Firestore Listener (Hybrid)
        console.log('DEBUG: loadAdminUsers - Connecting to Firestore...');

        const renderUsers = (snap) => {
            console.log(`DEBUG: Snapshot received. Docs: ${snap.size}`);
            const users = [];
            snap.forEach(doc => {
                const d = doc.data();
                users.push({ id: doc.id, ...d });
            });

            // Update Counts
            if (countTotal) countTotal.innerText = users.length;
            if (countActive) countActive.innerText = users.filter(u => u.status === 'active').length;
            if (countSuspended) countSuspended.innerText = users.filter(u => u.status !== 'active').length;

            area.innerHTML = '';

            // Plan Map
            const planMap = { 1: 'Aluno (Grátis)', 4: 'Escola Básico', 5: 'Professor Start', 6: 'Professor Pro', 7: 'Professor Elite' };

            users.forEach(u => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 hover:bg-slate-50 transition-colors';
                const planName = planMap[u.plan_id] || 'Desconhecido';

                tr.innerHTML = `
                    <td class="p-4"><div class="font-bold text-slate-700">${u.name || 'Sem nome'}</div><div class="text-xs text-slate-400">${u.email}</div></td>
                    <td class="p-4"><div class="text-xs text-slate-500"><span class="font-bold text-slate-700">♪ ${u.instrument || '-'}</span><br>${u.phone || '-'}</div></td>
                    <td class="p-4">
                        <span class="px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : (u.role === 'professor' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}">${u.role}</span>
                    </td>
                    <td class="p-4"><div class="text-xs font-medium text-slate-600">${planName}</div></td>
                    <td class="p-4"><span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${u.status === 'active' ? 'Ativo' : 'Suspenso'}</span></td>
                    <td class="p-4 text-center">
                        <button onclick="app.editUser('${u.id}')" class="text-slate-400 hover:text-blue-600"><span class="material-icons-round text-lg">edit</span></button>
                    </td>
                `;
                area.appendChild(tr);
            });
        };

        const onError = (err) => {
            console.error(err);
            area.innerHTML = '<tr><td colspan="6" class="text-red-500 p-4 text-center">Erro ao carregar do Firestore.</td></tr>';
        };

        if (app.namedDb && window.firestoreUtils) {
            const { collection, onSnapshot, getFirestore } = window.firestoreUtils;
            console.log("%c [ADMIN] Usando Banco NOMEADO (Hybrid)", "background: #059669; color: white;");
            onSnapshot(collection(app.namedDb, 'users'), renderUsers, onError);
        } else {
            console.warn("%c [ADMIN] Fallback para DEFAULT", "background: #f59e0b; color: black;");
            app.db.collection('users').onSnapshot(renderUsers, onError); // Compat takes function directly for next/error
        }
    },

    modalAddUser: async () => {
        // Hardcoded Plans (Serverless Mode)
        const plans = [
            { id: 1, name: 'Aluno (Grátis)', price: '0,00' },
            { id: 4, name: 'Escola Básico', price: '99,00' },
            { id: 5, name: 'Professor Start', price: '49,90' },
            { id: 6, name: 'Professor Pro', price: '79,90' },
            { id: 7, name: 'Professor Elite', price: '129,90' }
        ];

        const planOptions = plans.map(p => `<option value="${p.id}">${p.name} - R$ ${p.price}</option>`).join('');

        const content = `
            <div class="space-y-4 text-left">
                <div>
                    <label class="block text-sm font-bold mb-1">E-mail</label>
                    <input id="new-user-email" type="email" class="w-full rounded border-slate-300 p-2" placeholder="email@exemplo.com">
                </div>
                <div>
                    <label class="block text-sm font-bold mb-1">Senha Inicial</label>
                    <input id="new-user-pass" type="text" class="w-full rounded border-slate-300 p-2" placeholder="123456">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold mb-1">Perfil (Role)</label>
                        <select id="new-user-role" class="w-full rounded border-slate-300 p-2">
                            <option value="student">Aluno</option>
                            <option value="professor">Professor</option>
                            <option value="school">Escola</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-1">Plano</label>
                        <select id="new-user-plan" class="w-full rounded border-slate-300 p-2">
                            <option value="1">Sem Plano</option>
                            ${planOptions}
                        </select>
                    </div>
                </div>
            </div>
        `;

        await app.modal({
            title: 'Novo Usuário',
            content: content,
            confirmText: 'Criar Usuário',
            onConfirm: async () => {
                const email = document.getElementById('new-user-email').value;
                const password = document.getElementById('new-user-pass').value;
                const role = document.getElementById('new-user-role').value;
                const plan_id = document.getElementById('new-user-plan').value || 1;

                if (!email || !password) return alert('E-mail e senha são obrigatórios.');

                try {
                    if (app.namedDb && window.firestoreUtils) {
                        // HYBRID CREATION (Secondary App to avoid logout)
                        const { initializeApp, getAuth, createUserWithEmailAndPassword, doc, setDoc } = window.firestoreUtils;

                        // Create Request-Scoped App for Auth Separation
                        const tempAppName = 'temp-create-user-' + Date.now();
                        const tempApp = initializeApp(app.firebaseConfig, tempAppName);
                        const tempAuth = getAuth(tempApp);

                        const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
                        const uid = cred.user.uid;

                        // Write to Named DB
                        await setDoc(doc(app.namedDb, 'users', uid), {
                            email,
                            role,
                            plan_id: parseInt(plan_id),
                            name: email.split('@')[0],
                            status: 'active',
                            createdAt: new Date().toISOString()
                        });

                        // Cleanup (if deleteApp exists, but letting it GC is fine too for now)
                        console.log("Usuário criado no Named DB:", uid);

                    } else {
                        // Fallback (Will likely logout admin or fail if simple fetch used)
                        throw new Error("Modo Híbrido necessário para criar usuários Admin.");
                    }

                    app.showToast('Usuário criado!');
                    // Listener will auto-update list
                } catch (e) {
                    console.error(e);
                    alert('Erro ao criar usuário: ' + e.message);
                }
            }
        });
    },

    editUser: async (id) => {
        // debug
        console.log('Editando usuário ID:', id);

        try {
            // 1. Buscando dados em paralelo
            const [usersRes, plansRes] = await Promise.all([
                fetch(`${app.API_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
                fetch(`${app.API_URL}/admin/plans`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
            ]);

            if (!usersRes.ok) {
                const errText = await usersRes.text();
                throw new Error(`Erro API Usuários (${usersRes.status}): ${errText}`);
            }
            if (!plansRes.ok) {
                const errText = await plansRes.text();
                throw new Error(`Erro API Planos (${plansRes.status}): ${errText}`);
            }

            const users = await usersRes.json();
            const plans = await plansRes.json();

            // Log para debug
            console.log('Users carregados:', users.length);
            console.log('Planos carregados:', plans.length);

            // Encontrar usuário (convertendo ID para string/int para garantir match)
            const user = users.find(u => u.id == id);

            if (!user) {
                console.error('Usuário não encontrado. ID buscado:', id, 'IDs disponíveis:', users.map(u => u.id));
                return alert('Erro: Usuário não encontrado na lista local.');
            }

            if (!Array.isArray(plans)) throw new Error('API retornou lista de planos inválida');

            const planOptions = plans.map(p => `
                <option value="${p.id}" ${user.plan_id === p.id ? 'selected' : ''}>${p.name} (Max: ${p.max_connections})</option>
            `).join('');

            const content = `
                <div class="space-y-4 text-left">
                     <p class="text-sm text-slate-500">Editando: <b>${user.email}</b></p>
                     
                     <div>
                        <label class="block text-sm font-bold mb-1">Status da Conta</label>
                        <select id="edit-user-status" class="w-full rounded border-slate-300 p-2">
                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>✅ Ativo</option>
                            <option value="suspended" ${user.status !== 'active' ? 'selected' : ''}>🚫 Suspenso / Inadimplente</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold mb-1">Perfil</label>
                            <select id="edit-user-role" class="w-full rounded border-slate-300 p-2">
                                <option value="student" ${user.role === 'student' ? 'selected' : ''}>Aluno</option>
                                <option value="professor" ${user.role === 'professor' ? 'selected' : ''}>Professor</option>
                                <option value="school" ${user.role === 'school' ? 'selected' : ''}>Escola</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold mb-1">Plano de Licença</label>
                            <select id="edit-user-plan" class="w-full rounded border-slate-300 p-2">
                                <option value="">Sem Plano</option>
                                ${planOptions}
                            </select>
                        </div>
                    </div>
                </div>
            `;

            await app.modal({
                title: 'Gerenciar Licença',
                content: content,
                confirmText: 'Salvar Alterações',
                onShow: () => {
                    const planSelect = document.getElementById('edit-user-plan');
                    const roleSelect = document.getElementById('edit-user-role');

                    if (planSelect && roleSelect) {
                        planSelect.addEventListener('change', () => {
                            const pid = parseInt(planSelect.value);
                            // Auto-set role based on known Plan IDs
                            if (pid === 4) roleSelect.value = 'school';
                            else if ([5, 6, 7].includes(pid)) roleSelect.value = 'professor';
                            else if (pid === 1) roleSelect.value = 'student';
                        });
                    }
                },
                onConfirm: async () => {
                    const status = document.getElementById('edit-user-status').value;
                    const role = document.getElementById('edit-user-role').value;
                    const plan_id = document.getElementById('edit-user-plan').value || null;

                    try {
                        await app.db.collection('users').doc(id).update({
                            status,
                            role,
                            plan_id: parseInt(plan_id)
                        });

                        app.showToast('Usuário atualizado!');
                        // No need to reload, onSnapshot handles it
                    } catch (e) {
                        console.error(e);
                        alert('Erro ao atualizar: ' + e.message);
                    }
                }
            });

        } catch (e) {
            console.error('Erro no fluxo de edição:', e);
            alert(`Erro ao abrir edição:\n${e.message}`);
        }
    },

    deleteUser: async (id) => {
        const confirmDelete = confirm('Tem certeza que deseja EXCLUIR este usuário? Esta ação não pode ser desfeita.');
        if (!confirmDelete) return;

        try {
            await app.db.collection('users').doc(id).delete();
            app.showToast('Usuário excluído.');
        } catch (e) {
            console.error(e);
            alert('Erro ao excluir: ' + e.message);
        }
    },

    deleteCifra: async (id) => {
        if (!confirm('Tem certeza que deseja apagar?')) return;

        try {
            if (app.namedDb && window.firestoreUtils) {
                const { doc, deleteDoc } = window.firestoreUtils;
                const docRef = doc(app.namedDb, 'cifras', id);
                await deleteDoc(docRef);
            } else {
                await app.db.collection('cifras').doc(id).delete();
            }

            app.showToast('Cifra removida.');
            // Filter handles removal from state via snapshot listener usually, but navigate updates view
            if (location.hash.includes('editor')) app.navigate('home');
        } catch (e) {
            console.error(e);
            alert('Erro ao apagar.');
        }
    },

    // --- CLASSROOM MODULE ---
    // --- CLASSROOM MODULE ---

    // Professor: Criar Sala
    startClassroom: async () => {
        try {
            const btn = document.getElementById('btn-start-class');
            if (btn) btn.disabled = true;

            const res = await fetch(`${app.API_URL}/classrooms`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!res.ok) throw new Error('Falha ao criar sala. Verifique seu plano.');

            const session = await res.json();

            // Mostrar modal com o código
            await app.modal({
                title: 'Aula Iniciada! 🔴',
                content: `
                    <div class="text-center space-y-4">
                        <p>Compartilhe este código com seus alunos:</p>
                        <div class="text-4xl font-mono font-bold text-primary tracking-widest bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-dashed border-primary select-all">
                            ${session.code}
                        </div>
                        <p class="text-sm text-slate-500">Limite: <b>${session.max_connections} alunos</b></p>
                        <p class="text-xs text-slate-400">Esta sala expira em 60 minutos.</p>
                    </div>
                `,
                confirmText: 'Entendi'
            });

        } catch (e) {
            alert(e.message);
        } finally {
            const btn = document.getElementById('btn-start-class');
            if (btn) btn.disabled = false;
        }
    },

    // Aluno: Entrar na Sala
    joinClassroom: async () => {
        const codeInput = document.getElementById('classroom-code-input');
        const code = codeInput.value.trim().toUpperCase();
        if (!code) return alert('Digite o código');

        const btn = document.querySelector('#classroom-join-area button');
        const originalText = btn.innerText;
        btn.innerText = 'Verificando...';
        btn.disabled = true;

        try {
            // 1. Tentar entrar (Join)
            const res = await fetch(`${app.API_URL}/classrooms/${code}/join`, { method: 'POST' });
            const data = await res.json();

            if (!res.ok) {
                // Tratamento especial para Sala Cheia (429) ou Expirada (400/404)
                throw new Error(data.message || 'Erro ao entrar na sala');
            }

            // Sucesso!
            document.getElementById('classroom-join-area').classList.add('hidden');
            document.getElementById('classroom-active-area').classList.remove('hidden');

            // Timer visual apenas
            let minutes = 59;
            let seconds = 59;
            setInterval(() => {
                seconds--;
                if (seconds < 0) { seconds = 59; minutes--; }
                const timerEl = document.getElementById('classroom-timer');
                if (timerEl) timerEl.innerText = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
            }, 1000);

        } catch (e) {
            app.modal({
                title: 'Acesso Negado 🚫',
                content: `<p class="text-center text-lg">${e.message}</p>`,
                confirmText: 'OK'
            });
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    // --- FIRESTORE OPERATIONS ---

    loadCifras: async () => {
        const list = document.getElementById('cifra-list');
        if (!list) return;

        // Limpar listener anterior se existir
        if (app.state.unsubs.cifras) {
            app.state.unsubs.cifras();
        }

        list.innerHTML = '<p style="color:var(--text-muted)">Sincronizando com Firestore...</p>';

        // DEBUG: Verificar qual banco está sendo usado
        console.log('%c [FIRESTORE DEBUG] Iniciando loadCifras...', 'background: #2563eb; color: white; padding: 4px; font-weight: bold;');

        // Tentar obter informações do banco conectado
        if (app.db._delegate && app.db._delegate._databaseId) {
            console.log('%c [BANCO CONECTADO]', 'background: #10b981; color: white; padding: 4px; font-weight: bold;', app.db._delegate._databaseId.database);
        } else if (app.db._databaseId) {
            console.log('%c [BANCO CONECTADO]', 'background: #10b981; color: white; padding: 4px; font-weight: bold;', app.db._databaseId.database);
        }

        try {
            // Listener em Tempo Real (Firestore)
            // Ordenação: Firestore requer índice para algumas ordens, mas updatedAt é comum
            const onSnapshotCallback = (snapshot) => {
                console.log(`%c [SNAPSHOT RECEBIDO] Documentos encontrados: ${snapshot.size}`, 'background: #10b981; color: white; padding: 4px; font-weight: bold;');

                const cifras = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    console.log(`%c [DOC] ${doc.id}:`, 'color: #3b82f6; font-weight: bold;', data.title, '|', data.artist);
                    cifras.push({ id: doc.id, ...data });
                });

                // Sort in memory to avoid index requirement initially or usage complexity
                cifras.sort((a, b) => {
                    // Handle Timestamp objects if they come from startAfter/etc, but here simple sort
                    const ta = a.updatedAt ? (a.updatedAt.seconds || 0) : 0;
                    const tb = b.updatedAt ? (b.updatedAt.seconds || 0) : 0;
                    // Fallback to simple number if it was migrated from RTDB as millis
                    const valA = typeof a.updatedAt === 'number' ? a.updatedAt : ta;
                    const valB = typeof b.updatedAt === 'number' ? b.updatedAt : tb;
                    return valB - valA;
                });

                app.state.cifras = cifras;
                app.filterCifras();
            };

            let unsub;
            if (app.namedDb && window.firestoreUtils) {
                const { collection, onSnapshot, getFirestore } = window.firestoreUtils;
                console.log("%c [LOAD] Usando Banco NOMEADO (Hybrid)", "background: #059669; color: white;");
                const colRef = collection(app.namedDb, 'cifras');
                unsub = onSnapshot(colRef, onSnapshotCallback, (error) => {
                    console.error("Firestore Listen Error:", error);
                    list.innerHTML = `<p style="color:red">Erro: ${error.message}</p>`;
                });
            } else {
                console.warn("%c [LOAD] Fallback para DEFAULT", "background: #f59e0b; color: black;");
                unsub = app.db.collection('cifras').onSnapshot(onSnapshotCallback, (error) => {
                    console.error("Firestore Listen Error:", error);
                    list.innerHTML = `<p style="color:red">Erro: ${error.message}</p>`;
                });
            }

            app.state.unsubs.cifras = unsub;

        } catch (e) {
            console.error('Erro ao configurar listener:', e);
            list.innerHTML = '<p style="color:red">Erro ao conectar.</p>';
        }
    },

    filterCifras: () => {
        const list = document.getElementById('cifra-list');
        if (!list) return;

        list.innerHTML = '';

        let filtered = app.state.cifras;

        // Se houver termo de busca (opcional, se quiser implementar busca local)
        // const term = ...

        if (filtered.length === 0) {
            list.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500">Nenhuma cifra encontrada.</div>`;
            return;
        }

        filtered.forEach(cifra => {
            const card = document.createElement('div');
            card.className = 'group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-3xl shadow-sm hover:shadow-xl hover:border-primary/50 transition-all cursor-pointer';
            card.onclick = () => app.navigate('cifra', cifra.id);

            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div class="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <span class="material-icons-round text-3xl">music_note</span>
                    </div>
                    <div class="flex space-x-1">
                        <span class="material-icons-round text-slate-200 dark:text-slate-600 text-lg hover:text-yellow-400">star_outline</span>
                        <button class="text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 transition-colors" onclick="event.stopPropagation(); app.navigate('editor', '${cifra.id}')">
                           <span class="material-icons-round text-xl">edit</span>
                        </button>
                    </div>
                </div>
                <h3 class="font-display font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors truncate">${cifra.title}</h3>
                <p class="text-slate-500 dark:text-slate-400 text-sm mb-4 truncate">${cifra.artist}</p>
                <div class="flex flex-wrap gap-2 mb-4">
                    <span class="bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">${cifra.genre || 'Geral'}</span>
                    <span class="bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">${cifra.tone || '?'}</span>
                </div>
            `;
            list.appendChild(card);
        });
    },

    showToast: (message) => {
        const toast = document.createElement('div');
        toast.innerText = message;
        toast.style.cssText = 'position:fixed; bottom: 100px; right: 2rem; background: #1e293b; color: white; padding: 0.75rem 1.5rem; border-radius: 12px; font-size: 0.9em; font-weight: 600; z-index: 9999; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); opacity: 0; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events:none; transform: translateY(10px); border: 1px solid rgba(255,255,255,0.1);';
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // --- MODAL SYSTEM (Premium Dialogs) ---
    modal: ({ title, content, input = false, confirmText = 'OK', cancelText = 'Cancelar', placeholder = '', onConfirm = null, onShow = null }) => {
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
            requestAnimationFrame(() => {
                document.body.classList.add('modal-active');
                // Executar onShow callback se existir
                if (typeof onShow === 'function') {
                    onShow(id);
                }
            });

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

                // Allow custom callback for complex modals
                if (typeof onConfirm === 'function') {
                    onConfirm();
                    cleanup(true);
                    return;
                }

                // Custom logic for Chord Creator...

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

    transpose: (step) => {
        if (!app.state.currentCifra) return;

        // Atualiza estado (step pode ser +1 ou -1)
        app.state.currentTranspose += step;
        const total = app.state.currentTranspose;

        // Feedback Visual no Display
        const display = document.getElementById('transposer-display');
        if (display) {
            const sign = total > 0 ? '+' : '';
            display.innerText = total === 0 ? 'Original' : `${sign}${total}`;
            // Mudar cor se não for original
            display.style.color = total === 0 ? '' : 'var(--primary-color)';
        }

        // Transpor Conteúdo
        // IMPORTANTE: Sempre transpor a partir do CONTEÚDO ORIGINAL para não acumular erros
        const originalContent = app.state.currentCifra.content;

        let newContent;
        if (typeof Transposer !== 'undefined') {
            newContent = Transposer.transposeSong(originalContent, total);
        } else {
            console.error("Módulo Transposer não carregado!");
            return;
        }

        // Renderizar novo conteúdo
        // Reutilizar a lógica de renderização do loadCifra (simplificada)
        let contentHtml = newContent.replace(/\r\n/g, '\n');

        // (Re-aplicar filtros de visualização como Pausa e Formatação de Acordes)
        contentHtml = contentHtml.replace(/\[p\|(\d*)(?:\|(\d*))?\|?\]/g, '<div style="height:1px;width:100%"></div>'); // Simplificado para preview
        contentHtml = contentHtml.replace(/\[\|.*?\|?\]/g, '');
        contentHtml = contentHtml.replace(/\[\..*?\|?\.\]/g, '');

        contentHtml = contentHtml.replace(/\[([^\]]+)\]/g, (match, chordName) => {
            if (chordName.startsWith('|') || chordName.startsWith('.')) return match;
            const openB = '<span class="chord-bracket">[</span>';
            const closeB = '<span class="chord-bracket">]</span>';

            if (app.isActualChord(chordName.replace(/\*+$/, ''))) {
                // Interactive chord click
                return `${openB}<b class="interactive-chord" onclick="app.showChordPopover(event, '${chordName}')">${chordName}</b>${closeB}`;
            } else {
                return `${openB}<b class="section-marker">${chordName}</b>${closeB}`;
            }
        });

        document.getElementById('view-content').innerHTML = contentHtml;

        // Atualizar Galeria de Acordes
        app.updateChordGallery(newContent);

        // Mostrar Botão "Salvar Tom" se houve alteração
        const btnSave = document.getElementById('btn-save-tone');
        if (btnSave) {
            if (total !== 0 && app.state.user) {
                btnSave.classList.remove('hidden');
                btnSave.classList.add('flex');
            } else {
                btnSave.classList.add('hidden');
                btnSave.classList.remove('flex');
            }
        }
    },

    saveTransposition: async () => {
        if (!app.state.currentCifra || app.state.currentTranspose === 0) return;

        console.log("Iniciando saveTransposition...");
        const btn = document.getElementById('btn-save-tone');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Salvando...';
        btn.disabled = true;

        try {
            // 1. Calcular o novo conteúdo transpustado FINAL
            const total = app.state.currentTranspose;
            const originalContent = app.state.currentCifra.content;
            const newContent = Transposer.transposeSong(originalContent, total);

            console.log("Transposição - Passo: " + total);

            // 2. Simplificar Atualização do TOM
            let newTom = app.state.currentCifra.tom;

            // Se o tom atual for válido, tenta transpor
            if (newTom) {
                const cleanTom = newTom.trim();
                // Tenta transpor independente da validação estrita, se parecer um acorde
                if (/^[A-Ga-g]/.test(cleanTom)) {
                    newTom = Transposer.transposeChord(cleanTom, total);
                    console.log(`Tom antigo: ${app.state.currentCifra.tom} -> Novo Tom: ${newTom}`);
                }
            }

            // 3. Persistir Firestore
            const id = app.state.currentCifra.id;
            console.log("Salvando no ID: " + id);

            // HYBRID CHECK
            if (app.namedDb && window.firestoreUtils) {
                const { doc, updateDoc } = window.firestoreUtils;
                const docRef = doc(app.namedDb, 'cifras', id);
                console.log("Usando NamedDB...");
                await updateDoc(docRef, {
                    content: newContent,
                    tom: newTom || app.state.currentCifra.tom,
                    updatedAt: new Date().toISOString()
                });
            } else {
                console.log("Usando Default DB...");
                await app.db.collection('cifras').doc(id).update({
                    content: newContent,
                    tom: newTom || app.state.currentCifra.tom,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            console.log("Salvo com sucesso!");

            // 4. Resetar Estado Local para refletir que agora é o "Original"
            app.state.currentCifra.content = newContent;
            app.state.currentCifra.tom = newTom;
            app.state.currentTranspose = 0;

            // UI Update
            document.getElementById('transposer-display').innerText = "Original";
            document.getElementById('transposer-display').style.color = '';

            // Update Tone Badge
            const tomEl = document.getElementById('view-tom');
            if (newTom) {
                tomEl.innerText = `🎼 Tom: ${newTom}`;
                tomEl.style.display = 'inline-block';
            }

            // Hide Save Button
            btn.classList.add('hidden');
            btn.classList.remove('flex');

            app.showToast('Novo tom salvo com sucesso!');

        } catch (e) {
            console.error(e);
            alert('Erro ao salvar tom: ' + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    updateChordGallery: (content) => {
        const chordsContainer = document.getElementById('view-chords-container');
        const chordsList = document.getElementById('view-chords-list');

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
            chordsContainer.style.display = 'block';
            chordsList.innerHTML = '';
            foundChords.forEach(chordName => {
                const card = app.createChordCard(chordName, false);
                if (card) chordsList.appendChild(card);
            });
        } else {
            chordsContainer.style.display = 'none';
        }
    },

    editorTranspose: (step) => {
        // 1. Pegar conteúdo atual do editor
        const textarea = document.getElementById('edit-content');
        const tomInput = document.getElementById('edit-tom');

        if (!textarea || !textarea.value) return;

        const currentContent = textarea.value;
        const currentTom = tomInput.value.trim();

        // 2. Transpor Conteúdo
        if (typeof Transposer !== 'undefined') {
            const newContent = Transposer.transposeSong(currentContent, step);

            // Manter cursor/scroll? Por enquanto substitui tudo
            textarea.value = newContent;

            // 3. Transpor Tom (se válido)
            if (currentTom && app.isActualChord(currentTom)) {
                const newTom = Transposer.transposeChord(currentTom, step);
                tomInput.value = newTom;
            }

            // 4. Feedback
            app.updateEditorPreview();
            app.showToast(step > 0 ? 'Tom aumentado (+1 semitom)' : 'Tom diminuído (-1 semitom)');
        } else {
            alert("Módulo de transposição não carregado!");
        }
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
            if (data.bpm && app.state.user) {
                app.state.metronome.bpm = parseInt(data.bpm);
                document.getElementById('metronome-bpm-label').innerText = `BPM: ${data.bpm}`;
                document.getElementById('metronome-display').style.display = 'flex';
                // app.startMetronome(); // REMOVED: No more auto-start
            } else {
                document.getElementById('metronome-display').style.display = 'none';
            }

            // --- YouTube Setup ---
            const btnYoutube = document.getElementById('btn-youtube-view');
            const btnTraining = document.getElementById('btn-youtube-training');

            if (data.youtube) {
                btnYoutube.style.display = 'flex';
            } else {
                btnYoutube.style.display = 'none';
            }

            if (data.youtubeTraining && app.state.user) {
                btnTraining.style.display = 'flex';
            } else {
                btnTraining.style.display = 'none';
            }

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

            const tomEl = document.getElementById('view-tom');
            if (data.tom) {
                tomEl.innerText = `🎼 Tom: ${data.tom}`;
                tomEl.style.display = 'inline-block';
            } else {
                tomEl.style.display = 'none';
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
            const btnLyrics = document.getElementById('btn-mode-lyrics');
            const btnTabs = document.getElementById('btn-mode-tabs');

            const hasTabs = !!(data.tabs && data.tabs.trim());
            const hasBpm = !!(data.bpm && app.state.user);

            if (hasTabs || hasBpm) {
                toggleContainer.style.display = 'flex';

                if (hasTabs) {
                    tabsDiv.innerText = data.tabs;
                    btnLyrics.style.display = 'inline-block';
                    btnTabs.style.display = 'inline-block';
                } else {
                    btnLyrics.style.display = 'none';
                    btnTabs.style.display = 'none';
                }
                app.setContentView('lyrics'); // Reset to lyrics
            } else {
                toggleContainer.style.display = 'none';
                app.setContentView('lyrics');
            }

            // Standard Chord Replacement (Regex) - Reverting Smart Logic
            contentHtml = contentHtml.replace(/\[([^\]]+)\]/g, (match, chordName) => {
                if (chordName.startsWith('|') || chordName.startsWith('.')) return match;

                const openB = '<span class="chord-bracket">[</span>';
                const closeB = '<span class="chord-bracket">]</span>';

                const fullChordName = chordName;
                const cleanBase = chordName.replace(/\*+$/, '');

                if (app.isActualChord(cleanBase)) {
                    return `${openB}<b class="interactive-chord" onclick="app.showChordPopover(event, '${fullChordName}')">${fullChordName}</b>${closeB}`;
                } else {
                    return `${openB}<b class="section-marker">${fullChordName}</b>${closeB}`;
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
            // --- Reset Transposition State ---
            app.state.currentTranspose = 0;
            const transposerUI = document.getElementById('transposer-controls');
            const transposerDisplay = document.getElementById('transposer-display');
            const btnSaveTone = document.getElementById('btn-save-tone');

            if (transposerUI) {
                // Show transposer only if it's a song (has content)
                transposerUI.style.display = 'flex';
                transposerUI.classList.remove('hidden');
                transposerDisplay.innerText = "Original";
                transposerDisplay.style.color = '';
            }
            if (btnSaveTone) {
                btnSaveTone.classList.add('hidden');
                btnSaveTone.classList.remove('flex');
            }

            app.renderHeader('cifra'); // Re-run to ensure buttons appear if state matches

        } catch (e) {
            console.error('Erro em loadCifra:', e);
            if (e.code === 'permission-denied') {
                alert('Acesso negado: Você não tem permissão para visualizar esta cifra (pode ser um Rascunho privado).');
                app.navigate('home');
            } else {
                alert(`Erro ao carregar cifra: ${e.message}`);
            }
        }
    },

    toggleMetronome: () => {
        if (app.state.metronome.active) {
            app.stopMetronome();
        } else {
            app.startMetronome();
        }
    },

    startMetronome: () => {
        const bpm = app.state.metronome.bpm;
        if (!bpm || bpm <= 0) return;

        app.stopMetronome();
        const ms = (60 / bpm) * 1000;
        const dot = document.getElementById('metronome-dot');

        app.state.metronome.active = true;

        // Setup Audio for Beep
        if (!app.audioCtx) {
            app.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const playBeep = () => {
            if (!app.state.metronome.active) return;
            const osc = app.audioCtx.createOscillator();
            const gain = app.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, app.audioCtx.currentTime); // A5 note

            gain.gain.setValueAtTime(0.1, app.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, app.audioCtx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(app.audioCtx.destination);

            osc.start();
            osc.stop(app.audioCtx.currentTime + 0.1);
        };

        app.state.metronome.interval = setInterval(() => {
            if (dot) {
                dot.style.background = 'var(--primary-color)';
                dot.style.transform = 'scale(1.3)';
                setTimeout(() => {
                    dot.style.background = 'var(--text-muted)';
                    dot.style.transform = 'scale(1)';
                }, 100);
            }
            playBeep();
        }, ms);

        // Play first beat immediately
        playBeep();
    },

    stopMetronome: () => {
        if (app.state.metronome.interval) {
            clearInterval(app.state.metronome.interval);
            app.state.metronome.interval = null;
        }
        app.state.metronome.active = false;

        // Reset dot state
        const dot = document.getElementById('metronome-dot');
        if (dot) {
            dot.style.background = 'var(--text-muted)';
            dot.style.transform = 'scale(1)';
        }
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
            console.error('Erro ao excluir:', e);
            app.modal({ title: 'Erro', content: `Erro ao excluir: ${e.message}`, confirmText: 'OK', cancelText: null });
        }
    },

    // --- SETLISTS ---
    loadSetlists: async () => {
        if (!app.state.user) return;

        // Remove previous listener
        if (app.state.unsubs.setlists) {
            app.db.ref('setlists').off('value', app.state.unsubs.setlists);
            app.state.unsubs.setlists = null;
        }

        // onSnapshot
        const unsub = app.db.collection('setlists').onSnapshot((snap) => {
            const setlists = [];
            snap.forEach(doc => {
                setlists.push({ id: doc.id, ...doc.data() });
            });
            // Manual sort
            setlists.sort((a, b) => {
                const ta = a.updatedAt ? (a.updatedAt.seconds || 0) : 0;
                const tb = b.updatedAt ? (b.updatedAt.seconds || 0) : 0;
                return tb - ta;
            });
            app.state.setlists = setlists;
            app.renderSetlistsGrid();
        });

        app.state.unsubs.setlists = unsub;
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
            // Listener should update UI
        } catch (e) {
            console.error(e);
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
            app.showToast('Repertório removido.');
        } catch (e) {
            console.error(e);
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
            const ref = app.db.collection('setlists').doc(setlistId);
            const doc = await ref.get();
            if (!doc.exists) return;

            const data = doc.data();
            const songs = data.songs || [];

            if (!songs.includes(songId)) {
                songs.push(songId);
                await ref.update({
                    songs: songs,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                app.showToast('Música adicionada ao repertório!');
            } else {
                alert('Esta música já está neste repertório.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao adicionar música.');
        }
    },

    // Assuming a 'login' function would be here, based on the provided snippet context.
    // Since the full document doesn't contain a 'login' function, I'll place 'register' after 'addToSetlist'
    // and before 'playSetlist', as it seems to be a new top-level function.
    // The instruction "Add register function after login function" implies 'login' exists.
    // Given the provided snippet for 'register' starts with `alert(data.message || 'Login falhou');`
    // and `alert('Erro de conexão ao fazer login.');`, it suggests a login function was intended to be there.
    // I will insert the register function here, and then the logout function as provided in the snippet.

    // Placeholder for a hypothetical login function, as implied by the snippet context:
    // login: async (e) => {
    //     e.preventDefault();
    //     const email = e.target.email.value;
    //     const password = e.target.password.value;
    //     try {
    //         const res = await fetch(`${app.API_URL}/auth/login`, {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({ email, password })
    //         });
    //         const data = await res.json();
    //         if (res.ok) {
    //             app.state.user = data.user;
    //             localStorage.setItem('token', data.token);
    //             app.navigate('home');
    //         } else {
    //             alert(data.message || 'Login falhou');
    //         }
    //     } catch (e) {
    //         console.error(e);
    //         alert('Erro de conexão ao fazer login.');
    //     }
    // },

    register: async (e) => {
        e.preventDefault();
        const form = e.target;
        const name = form.name.value;
        const cpf = form.cpf ? form.cpf.value : '';
        const phone = form.phone ? form.phone.value : '';
        const email = form.email.value;
        const password = form.password.value;
        const type = form.type.value; // student, professor_start, etc.
        const instrument = form.instrument ? form.instrument.value : 'Violão';

        if (!email || !password || !name) {
            app.showToast('Preencha os campos obrigatórios.');
            return;
        }

        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Criando conta...';
        }

        try {
            // 1. Create Auth User (HYBRID FIX: Use Modular Auth if valid, to share context with NamedDB)
            let userCredential;
            let dbUtils = (window.firestoreBridge && window.firestoreBridge.utils) ? window.firestoreBridge.utils : window.firestoreUtils;

            if (app.namedDb && dbUtils && dbUtils.getAuth) {
                console.log('[REGISTER] Usando Auth Modular (Bridge) para garantir contexto...');
                const auth = dbUtils.getAuth(); // Get auth from the SAME app as the DB
                userCredential = await dbUtils.createUserWithEmailAndPassword(auth, email, password);
            } else {
                console.warn('[REGISTER] Auth Modular indisponível. Usando Compat (Pode causar erro de permissão no Banco).');
                userCredential = await app.auth.createUserWithEmailAndPassword(email, password);
            }

            const uid = userCredential.user.uid;

            // 2. Determine Role & Plan ID
            let role = 'student';
            let plan_id = 1; // Free default

            // Map type to IDs (Approximate mapping based on legacy)
            // student -> 1
            // professor_start -> 2
            // professor_pro -> 3
            // professor_elite -> 4
            // school_basic -> 5

            if (type.includes('professor')) {
                role = 'school'; // or 'professor' if you have that role
                if (type === 'professor_start') plan_id = 2;
                if (type === 'professor_pro') plan_id = 3;
                if (type === 'professor_elite') plan_id = 4;
            } else if (type.includes('school')) {
                role = 'school';
                plan_id = 5;
            }

            // 3. Create Firestore Profile
            // dbUtils already resolved above

            // Create userData with modular API timestamp
            const userData = {
                email: email,
                name: name,
                role: role,
                plan_id: plan_id,
                cpf: cpf,
                phone: phone,
                instrument: instrument,
                status: 'active', // Active default for now, or 'pending_payment'
                section: role === 'admin' ? 'admin' : 'student',
                createdAt: dbUtils.serverTimestamp() // Use modular API
            };

            // 3. DIRECT FIRESTORE PROFILE CREATION (Legacy/Robust Flow)
            // Writing immediately to ensure consistency and avoid auth-state race conditions
            console.log('[REGISTER] Criando perfil no Firestore...');

            try {
                // Determine DB Utils (Bridge)
                const { doc, setDoc, serverTimestamp } = dbUtils;

                // DIAGNÓSTICO DO BANCO DE DADOS (Silent Check)
                if (app.namedDb) {
                    const dbName = app.namedDb._databaseId ? app.namedDb._databaseId.database : (app.namedDb.databaseId || 'unknown');
                    console.log(`[REGISTER] Salvando em banco: ${dbName}`);
                }

                const userRef = doc(app.namedDb, 'users', uid);

                // Add Timestamp
                userData.createdAt = serverTimestamp();

                // Write with MERGE to play nice with Cloud Functions
                await setDoc(userRef, userData, { merge: true });
                console.log('[REGISTER] Módulo de perfil salvo.');

            } catch (dbError) {
                console.error('[REGISTER] Falha na criação primária do perfil:', dbError);
                // ALERT: Não engolir erro durante debug crítico
                alert(`ERRO CRÍTICO AO SALVAR PERFIL: ${dbError.message}`);
                throw dbError;
            }

            console.log('[REGISTER] Auth e Perfil processados.');

            // Clear legacy pending data if it exists
            localStorage.removeItem('pending_registration_data');

            // Simulate success delay for UX
            await new Promise(resolve => setTimeout(resolve, 500));

            // 4. Update Function State
            const user = { id: uid, ...userData };
            app.state.user = user;
            localStorage.setItem('token', 'firebase-session');
            localStorage.setItem('user', JSON.stringify(user));

            app.showToast('Conta criada com sucesso! 🚀');

            // 5. Payment Redirect (User Request for Test Link)
            // Triggering for ALL registrations.

            const paymentLink = 'https://invoice.infinitepay.io/plans/saulo-diogo/1nBPlUHLod';

            // Allow all plans to see the link for testing
            if (true) {
                const payConfirmed = await app.modal({
                    title: 'Finalizar Assinatura 💳',
                    content: `Sua conta foi criada! Para ativar o plano <b>${type.toUpperCase().replace('_', ' ')}</b>, finalize o pagamento de teste (R$ 5,00).`,
                    confirmText: 'Pagar Agora',
                    cancelText: 'Pagar depois'
                });

                if (payConfirmed) {
                    window.location.href = paymentLink;
                    return;
                }
                // If Cancel, continue to navigation...
            }

            // 6. Navigation
            if (role === 'school') app.navigate('school');
            else app.navigate('home');

        } catch (error) {
            console.error('Registro falhou:', error);
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') {
                // Tenta recuperar 'usuário órfão' (tem Auth mas não tem Banco)
                try {
                    // Tenta logar para obter o UID
                    const userCredential = await app.auth.signInWithEmailAndPassword(email, password);
                    const uid = userCredential.user.uid;

                    // Verifica se já existe no banco (Named DB)
                    let exists = false;
                    let dbUtilsRec = (window.firestoreBridge && window.firestoreBridge.utils) ? window.firestoreBridge.utils : window.firestoreUtils;

                    if (app.namedDb && dbUtilsRec) {
                        const snap = await dbUtilsRec.getDoc(dbUtilsRec.doc(app.namedDb, 'users', uid));
                        exists = snap.exists();
                    } else {
                        // Strict: if no named DB, assume failure
                        throw new Error("ERRO CRÍTICO: Sem conexão com banco.");
                    }

                    if (!exists) {
                        // RECOVERY FLOW: Cria o perfil que faltava
                        console.log('[REGISTER] Recuperando usuário órfão:', uid);

                        // Executa lógica de criação de perfil (Refatorar para função seria melhor, mas repetindo para segurança imediata)
                        // ... Repetindo Passo 2 e 3 ...
                        let role = 'student';
                        let plan_id = 1;
                        if (type.includes('professor')) {
                            role = 'school';
                            if (type === 'professor_start') plan_id = 2;
                            if (type === 'professor_pro') plan_id = 3;
                            if (type === 'professor_elite') plan_id = 4;
                        } else if (type.includes('school')) {
                            role = 'school';
                            plan_id = 5;
                        }

                        const userData = {
                            email: email,
                            name: name,
                            role: role,
                            plan_id: plan_id,
                            cpf: cpf,
                            phone: phone,
                            instrument: instrument,
                            status: 'active',
                            section: role === 'admin' ? 'admin' : 'student',
                            // CORREÇÃO: Inicializa com data string ISO segura para evitar erro de tipos mistos
                            // O timestamp do servidor será aplicado no setDoc se disponível
                            createdAt: new Date().toISOString()
                        };

                        if (app.namedDb && dbUtilsRec) {
                            const { doc, setDoc, serverTimestamp } = dbUtilsRec;
                            console.log("%c [RECOVERY] Usando Banco NOMEADO", "background: #059669; color: white;");

                            // Sobrescreve com ServerTimestamp MODULAR correto
                            userData.createdAt = serverTimestamp();

                            await setDoc(doc(app.namedDb, 'users', uid), userData);
                        } else {
                            // STRICT MODE: NO FALLBACK
                            // Se cair aqui, a data ISO será usada (mas vai falhar no throw abaixo de qualquer jeito)
                            throw new Error("ERRO CRÍTICO: Conexão com banco 'cifraprox' perdida na Recuperação.");
                        }

                        // Update State & Notify
                        const user = { id: uid, ...userData };
                        app.state.user = user;
                        localStorage.setItem('token', 'firebase-session');
                        localStorage.setItem('user', JSON.stringify(user));
                        app.showToast('Conta recuperada e ativada! 🚀');

                        // Payment Logic (Repetida)
                        const paymentLink = 'https://invoice.infinitepay.io/plans/saulo-diogo/1nBPlUHLod';
                        const payConfirmed = await app.modal({
                            title: 'Finalizar Assinatura 💳',
                            content: `Sua conta foi criada! Para ativar o plano <b>${type.toUpperCase().replace('_', ' ')}</b>, finalize o pagamento de teste (R$ 5,00).`,
                            confirmText: 'Pagar Agora',
                            cancelText: 'Pagar depois'
                        });

                        if (payConfirmed) {
                            window.location.href = paymentLink;
                            return;
                        }
                        // Continue to navigation (fall through to main flow if applicable, or duplicate nav)
                        // Note: The main flow below lines 2454 is inside the catch block which ends.
                        // We need to navigate explicitly here since we are inside the recovery block.

                        // 6. Navigation (Recovery)
                        if (role === 'school') app.navigate('school');
                        else app.navigate('home');

                        return; // Done with recovery
                    } else {
                        msg = 'Este email já possui cadastro completo. Faça Login.';
                    }
                } catch (loginErr) {
                    console.error('Erro ao recuperar orfão:', loginErr);
                    // Se a senha estiver errada, vai cair aqui
                    msg = 'Email já cadastrado. Se for você, faça login.';
                }
            }
            else if (error.code === 'auth/weak-password') msg = 'A senha deve ter pelo menos 6 caracteres.';

            app.showToast('Erro: ' + msg);
            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Criar Conta';
            }
        }
    },

    logout: () => {
        app.state.user = null;
        localStorage.removeItem('token');
        app.navigate('login'); // Assuming a login page exists
        app.showToast('Você foi desconectado.');
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
                    const doc = await app.db.collection('cifras').doc(songId).get();
                    if (doc.exists) c = { id: doc.id, ...doc.data() };
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
        // Populate inputs with defaults for new songs
        document.getElementById('edit-id').value = cifra.id || '';
        document.getElementById('edit-title').value = cifra.title || '';
        document.getElementById('edit-artist').value = cifra.artist || '';
        document.getElementById('edit-content').value = cifra.content || '[p|0|0|]\n\n';
        document.getElementById('edit-scrollSpeed').value = cifra.scrollSpeed || '1';
        document.getElementById('edit-scrollSpeedMobile').value = cifra.scrollSpeedMobile || cifra.scrollSpeed || '1';
        document.getElementById('edit-tom').value = cifra.tom || '';
        document.getElementById('edit-capo').value = cifra.capo || '';
        document.getElementById('edit-genre').value = cifra.genre || '';
        document.getElementById('edit-bpm').value = cifra.bpm || '';
        document.getElementById('edit-youtube').value = cifra.youtube || '';
        document.getElementById('edit-youtubeTraining').value = cifra.youtubeTraining || '';
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
            const fullChordName = chord;
            const cleanBase = chord.replace(/\*+$/, '');

            const openB = '<span class="chord-bracket">[</span>';
            const closeB = '<span class="chord-bracket">]</span>';

            if (app.isActualChord(cleanBase)) {
                return `${openB}<b class="interactive-chord" style="color:var(--chord-color); cursor:pointer;" onclick="app.showChordPopover(event, '${fullChordName}')">${fullChordName}</b>${closeB}`;
            } else {
                return `${openB}<b class="section-marker" style="color:var(--primary-color); font-weight:700;">${fullChordName}</b>${closeB}`;
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
                        await app.db.ref('custom_chords/' + app.getChordId(chordName)).remove();
                    } else {
                        await app.db.ref('custom_chords/' + app.getChordId(chordName)).set({
                            name: chordName,
                            variations: newVariations,
                            updatedAt: firebase.database.ServerValue.TIMESTAMP
                        });
                        Chords.dict[chordName] = newVariations;
                    }
                } else {
                    await app.db.ref('custom_chords/' + app.getChordId(chordName)).remove();
                    delete Chords.dict[chordName];
                }

                app.showToast('Excluído com sucesso!');
                if (typeof app.loadLibrary === 'function') app.loadLibrary(); // Reload if exists
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

    showChordPopover: (e, chordName) => {
        e.stopPropagation();
        app.hideChordPopover(); // Close previous if any

        const starsCount = chordName.split('*').length - 1;
        const cleanBase = chordName.replace(/\*+$/, '');

        const svg = Chords.render(cleanBase, starsCount);
        if (!svg) return;

        const popover = document.createElement('div');
        popover.className = 'chord-popover';
        popover.id = 'floating-chord-popover';

        popover.innerHTML = `
            <div class="chord-name">${cleanBase}</div>
            <div class="chord-svg-container">${svg}</div>
        `;

        document.body.appendChild(popover);

        // Position the popover
        const trigger = e.currentTarget;
        const rect = trigger.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();

        let top = rect.top - popoverRect.height - 10 + window.scrollY;
        let left = rect.left + (rect.width / 2) - (popoverRect.width / 2) + window.scrollX;

        // Ajustes para bordas da tela
        if (left < 10) left = 10;
        if (left + popoverRect.width > window.innerWidth - 10) {
            left = window.innerWidth - popoverRect.width - 10;
        }
        if (top < window.scrollY + 10) {
            top = rect.bottom + 10 + window.scrollY;
        }

        popover.style.top = top + 'px';
        popover.style.left = left + 'px';
    },

    hideChordPopover: () => {
        const existing = document.getElementById('floating-chord-popover');
        if (existing) existing.remove();
    },

    // --- SCHOOL CONTROLLER ---
    loadSchoolDashboard: async () => {
        console.log('[SCHOOL DEBUG] loadSchoolDashboard iniciado');
        console.log('[SCHOOL DEBUG] User:', app.state.user);

        const list = document.getElementById('school-professors-list');
        const empty = document.getElementById('school-empty-state');
        const nameDisplay = document.getElementById('school-name-display');

        console.log('[SCHOOL DEBUG] Elementos encontrados:', {
            list: !!list,
            empty: !!empty,
            nameDisplay: !!nameDisplay
        });

        if (nameDisplay && app.state.user) nameDisplay.innerText = app.state.user.name;

        if (!list) {
            console.error('[SCHOOL DEBUG] Elemento school-professors-list não encontrado!');
            return;
        }

        list.innerHTML = '<tr><td colspan="5" class="text-center py-4">Carregando...</td></tr>';

        try {
            const res = await fetch(`${app.API_URL}/school/professors`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Falha ao carregar');
            const professors = await res.json();

            list.innerHTML = '';
            if (professors.length === 0) {
                empty.classList.remove('hidden');
                return;
            }
            empty.classList.add('hidden');

            professors.forEach(p => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors';
                const statusBadge = p.status === 'active'
                    ? '<span class="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Ativo</span>'
                    : '<span class="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Inativo</span>';

                tr.innerHTML = `
                    <td class="px-6 py-4 font-bold text-slate-700 dark:text-white">${p.name}</td>
                    <td class="px-6 py-4">${p.email}</td>
                    <td class="px-6 py-4">${p.instrument || '-'}</td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="app.toggleProfessorStatus(${p.id}, '${p.status === 'active' ? 'inactive' : 'active'}')" 
                            class="text-xs font-bold border rounded px-2 py-1 ${p.status === 'active' ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-emerald-500 border-emerald-200 hover:bg-emerald-50'}">
                            ${p.status === 'active' ? 'Desativar' : 'Ativar'}
                        </button>
                    </td>
                `;
                list.appendChild(tr);
            });
        } catch (e) {
            console.error(e);
            list.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Erro ao carregar dados.</td></tr>';
        }
    },

    modalAddProfessor: () => {
        const content = `
            <div class="space-y-4 text-left">
                <div>
                    <label class="block text-sm font-bold mb-1">Nome Completo</label>
                    <input id="new-prof-name" type="text" class="w-full rounded border-slate-300 p-2" placeholder="Nome do professor">
                </div>
                <div>
                    <label class="block text-sm font-bold mb-1">E-mail</label>
                    <input id="new-prof-email" type="email" class="w-full rounded border-slate-300 p-2" placeholder="email@escola.com">
                </div>
                <div>
                    <label class="block text-sm font-bold mb-1">Senha Inicial</label>
                    <input id="new-prof-pass" type="text" class="w-full rounded border-slate-300 p-2" value="mudar123">
                </div>
                <div>
                    <label class="block text-sm font-bold mb-1">Instrumento</label>
                    <input id="new-prof-inst" type="text" class="w-full rounded border-slate-300 p-2" placeholder="Ex: Violão">
                </div>
            </div>
        `;

        app.modal({
            title: 'Novo Professor',
            content: content,
            confirmText: 'Criar Professor',
            onConfirm: async () => {
                const name = document.getElementById('new-prof-name').value;
                const email = document.getElementById('new-prof-email').value;
                const password = document.getElementById('new-prof-pass').value;
                const instrument = document.getElementById('new-prof-inst').value;

                if (!email || !password || !name) return alert('Campos obrigatórios: Nome, Email, Senha.');

                try {
                    const res = await fetch(`${app.API_URL}/school/professors`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify({ name, email, password, instrument })
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.message || 'Erro ao criar');
                    }
                    app.showToast('Professor criado com sucesso!');
                    app.loadSchoolDashboard();
                } catch (e) {
                    alert('Erro: ' + e.message);
                }
            }
        });
    },

    toggleProfessorStatus: async (id, status) => {
        if (!confirm(`Deseja realmente definir este professor como ${status}?`)) return;
        try {
            const res = await fetch(`${app.API_URL}/school/professors/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                app.showToast('Status atualizado!');
                app.loadSchoolDashboard();
            } else {
                alert('Erro ao atualizar status.');
            }
        } catch (e) {
            console.error(e);
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
        div.innerHTML = `${label} < span id = "loop-seconds" > ${remaining}</span > s...`;

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
            let svgStr = `< svg width = "${w}" height = "${h}" viewBox = "0 0 ${w} ${h}" xmlns = "http://www.w3.org/2000/svg" > `;

            // Nut
            const barVal = parseInt(document.getElementById('chord-bar')?.value || chordData.bar);
            const nutWidth = barVal > 0 ? 1 : 4;
            svgStr += `< line x1 = "${m}" y1 = "${m}" x2 = "${w - m}" y2 = "${m}" stroke = "#4b5563" stroke - width="${nutWidth}" /> `;

            // Strings
            for (let i = 0; i < 6; i++) {
                const x = m + i * sGap;
                svgStr += `< line x1 = "${x}" y1 = "${m}" x2 = "${x}" y2 = "${h - m}" stroke = "#9ca3af" stroke - width="1" /> `;
            }

            // Frets
            for (let i = 1; i <= 5; i++) {
                const y = m + i * fGap;
                svgStr += `< line x1 = "${m}" y1 = "${y}" x2 = "${w - m}" y2 = "${y}" stroke = "#9ca3af" stroke - width="1" /> `;
            }

            // Status Row (O/X)
            chordData.p.forEach((fret, sIndex) => {
                const x = m + sIndex * sGap;
                if (fret === -1) {
                    svgStr += `< text x = "${x}" y = "${m - 7}" text - anchor="middle" fill = "#ef4444" font - size="16" font - family="sans-serif" >×</text > `;
                } else if (fret === 0) {
                    svgStr += `< circle cx = "${x}" cy = "${m - 10}" r = "4.5" stroke = "#059669" stroke - width="2" fill = "none" /> `;
                }
            });

            // Barre (Pestana)
            const noBarLine = document.getElementById('chord-no-bar')?.checked;
            if (barVal > 0) {
                const y = m + (1 * fGap) - (fGap / 2);
                if (!noBarLine) {
                    svgStr += `< rect x = "${m - 3}" y = "${y - 6}" width = "${w - 2 * m + 6}" height = "12" rx = "3" fill = "#059669" /> `;
                }
                svgStr += `< text x = "0" y = "${y + 6}" fill = "#4b5563" font - size="14" font - family="sans-serif" font - weight="bold" > ${barVal}ª</text > `;
            }

            // Fingers
            chordData.p.forEach((fret, sIndex) => {
                if (fret > 0 && fret <= 5) {
                    const x = m + sIndex * sGap;
                    const y = m + (fret * fGap) - (fGap / 2);
                    // Não desenha se houver pestana na casa 1 (simplificação visual do card), A MENOS que noBarLine esteja marcado
                    if (barVal > 0 && fret === 1 && !noBarLine) return;
                    svgStr += `< circle cx = "${x}" cy = "${y}" r = "7.5" fill = "#059669" /> `;
                }
            });

            svgStr += `</svg > `;

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
        < div class= "chord-editor-container" >
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

                await app.db.ref('custom_chords/' + app.getChordId(name)).set({
                    name: name,
                    variations: variations,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
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

console.log('%c VERIFICANDO ESTADO DO DOM...', 'background: yellow; color: black; padding: 5px;');

// FIX: Com defer, o DOMContentLoaded já disparou. Precisamos verificar o estado.
if (document.readyState === 'loading') {
    // DOM ainda carregando (raro com defer)
    console.log('%c DOM ainda carregando, aguardando DOMContentLoaded...', 'background: orange; color: black; padding: 5px;');
    document.addEventListener('DOMContentLoaded', app.init);
} else {
    // DOM já está pronto (caso comum com defer)
    console.log('%c DOM JÁ PRONTO! Chamando app.init() imediatamente...', 'background: lime; color: black; padding: 5px; font-weight: bold;');
    app.init();
}
