// DEBUG: Immediate execution verification
console.log('%c ========================================', 'background: lime; color: black; font-size: 16px; padding: 5px;');
console.log('%c APP_V2.JS LOADED!', 'background: lime; color: black; font-size: 20px; padding: 10px; font-weight: bold;');
console.log('%c ========================================', 'background: lime; color: black; font-size: 16px; padding: 5px;');

// Check if Firebase is loaded
if (typeof firebase === 'undefined') {
    console.error('%c ERRO: Firebase não está carregado!', 'background: red; color: white; padding: 10px; font-size: 16px;');
    console.error('Aguardando Firebase carregar...');
    // Wait for Firebase to load
    const checkFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined') {
            clearInterval(checkFirebase);
            console.log('%c Firebase carregado! Continuando...', 'background: green; color: white; padding: 5px;');
            initializeApp();
        }
    }, 100);
} else {
    console.log('%c Firebase já está disponível!', 'background: green; color: white; padding: 5px;');
    initializeApp();
}

function initializeApp() {


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
        PLANS: [
            { id: 1, name: 'Aluno (Grátis)', price: '0,00', role: 'student' },
            { id: 4, name: 'Escola Básico', price: '99,00', role: 'school' },
            { id: 5, name: 'Professor Start', price: '49,90', role: 'professor' },
            { id: 6, name: 'Professor Pro', price: '79,90', role: 'professor' },
            { id: 7, name: 'Professor Elite', price: '129,90', role: 'professor' }
        ],

        // --- CONFIGURAÇÃO LOCAL ---
        // --- CONFIGURAÇÃO LOCAL ---
        // Se estiver em localhost (http-server), aponta para a Cloud Function de produção
        // Caso esteja rodando emulador local com proxy, o usuário deve ajustar ou usar firebase serve
        API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
            ? 'https://us-central1-cifraprox-270126.cloudfunctions.net/api'
            : window.location.origin + '/api', // Produção (Firebase Hosting reescreve /api)


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

                while (!window.firestoreBridge && !window.connectToNamedDB && !window.firestoreUtils && attempts < maxAttempts) {
                    if (attempts % 10 === 0) console.log(`[INIT] Aguardando Bridge/Utils... (${attempts}/${maxAttempts})`);
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                if (window.firestoreBridge || window.connectToNamedDB || window.firestoreUtils) {
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

                        // FIX: Ensure app state has the UID immediately to prevent race conditions
                        if (!app.state.user) app.state.user = { role: 'guest' }; // Temporary fallback
                        app.state.user.uid = user.uid;

                        // FIX: Reload School Dashboard if we are already on that view (e.g. page refresh)
                        if (app.state.currentView === 'school') {
                            console.log('[AUTH STATE] Reloading School Dashboard to fix race condition...');
                            setTimeout(() => app.loadSchoolDashboard(), 800);
                        }

                        // Sync State from LocalStorage if available (Optimistic)
                        // Note: Real user data loading should happen via loadHeader or separate listener
                    } else {
                        console.log('[AUTH STATE] Usuário desconectado');
                        // Protect Guest User from being cleared
                        if (app.state.user && app.state.user.isGuest) {
                            console.log('[AUTH STATE] Mantendo sessão de visitante ativa.');
                        } else {
                            app.state.user = null;
                        }
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

                // Setup Masking listeners (delegate)
                document.body.addEventListener('input', (e) => {
                    if (e.target.id === 'reg-cpf') {
                        let v = e.target.value.replace(/\D/g, '');
                        if (v.length > 11) v = v.slice(0, 11);
                        e.target.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    }
                    if (e.target.id === 'reg-phone') {
                        let v = e.target.value.replace(/\D/g, '');
                        if (v.length > 11) v = v.slice(0, 11);
                        e.target.value = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
                    }
                });

                // Setup Masking listeners (delegate)
                document.body.addEventListener('input', (e) => {
                    if (e.target.id === 'reg-cpf') {
                        let v = e.target.value.replace(/\D/g, '');
                        if (v.length > 11) v = v.slice(0, 11);
                        e.target.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    }
                    if (e.target.id === 'reg-phone') {
                        let v = e.target.value.replace(/\D/g, '');
                        if (v.length > 11) v = v.slice(0, 11);
                        e.target.value = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
                    }
                });

                // Resume Registration Check
                const draft = localStorage.getItem('registrationDraft');
                if (draft && location.hash === '#register') {
                    const data = JSON.parse(draft);
                    if (confirm(`Existe um cadastro pendente para ${data.email}. Deseja continuar o pagamento?`)) {
                        app.showPaymentModal(data);
                    }
                }

                // Setup inicial
                let view = location.hash ? location.hash.substring(1).split('/')[0] : '';
                const param = location.hash ? location.hash.substring(1).split('/')[1] : null;

                console.log('[INIT] Detected view:', view, 'param:', param);

                // Se não estiver logado, forçar tela de login (exceto para rotas públicas)
                if (!app.state.user && view !== 'classroom' && view !== 'register') {
                    view = 'login';
                } else if (!view) {
                    // Redirecionar baseado no role do usuário (includes para variações como professor_start)
                    const userRole = (app.state.user && app.state.user.role) ? app.state.user.role : '';

                    if (userRole === 'admin') {
                        view = 'admin';
                    } else if (userRole.includes('school') || userRole.includes('professor')) {
                        view = 'school';
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
                history.replaceState({ view, param }, '', '#' + view + (param ? '/' + param : ''));
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
                if ((window.firestoreBridge && window.firestoreBridge.utils) || window.firestoreUtils) {
                    const utils = window.firestoreUtils || window.firestoreBridge.utils;
                    const authMod = utils.getAuth(app.namedDb.app);
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
            console.log(`[NAVIGATE DEBUG] View solicitada: ${view}, Param: ${param}`);

            if (view === 'login') {
                console.warn('[NAVIGATE] Redirecionando para LOGIN! Rastreamento de origem:');
                console.trace(); // Mostra quem chamou essa função
            }
            // --- SECURITY GUARD ---
            const role = app.state.user ? app.state.user.role : 'guest';

            console.log('[NAVIGATE DEBUG] View solicitada:', view, '| Role:', role);

            // Special handling for classroom view
            if (view === 'classroom') {
                console.log('[NAVIGATE] Classroom view detected! Param:', param, 'User:', app.state.user);
                if (!app.state.user) {
                    // Guest trying to access - show join modal
                    console.log('[NAVIGATE] No user logged in, showing join modal...');
                    app.showJoinClassroomModal(param);
                    return;
                }
                // Logged in user - proceed to classroom
                console.log('[NAVIGATE] User logged in, joining classroom...');
                app.state.currentView = view; // FIX: Update state before joining
                app.joinClassroom(param, 'user');
                return;
            }

            // 1. School Access Logic
            // 2. Prevent non-schools from accessing school dashboard
            if (view === 'school') {
                const userRole = (app.state.user ? app.state.user.role : '') || '';
                if (userRole !== 'admin' && !userRole.includes('school') && !userRole.includes('professor')) {
                    console.log('[NAVIGATE DEBUG] Não-school tentando acessar school - bloqueado. Role:', userRole);
                    app.showToast('Acesso negado.');
                    view = 'home';
                }
            }

            // 3. Prevent Students from accessing Admin
            if (view === 'admin' && role !== 'admin') {
                view = 'home';
            }

            // 4. Guest Guard (Global)
            if (role === 'guest' && view !== 'login' && view !== 'register') {
                console.log('[NAVIGATE DEBUG] Guest trying to access protected view:', view);
                app.showToast('Faça login para continuar.');
                view = 'login';
            }

            // 4. Guest Guard (Global)
            if (role === 'guest' && view !== 'login' && view !== 'register') {
                console.log('[NAVIGATE DEBUG] Guest trying to access protected view:', view);
                app.showToast('Faça login para continuar.');
                view = 'login';
            }

            // 4. Guest Guard (Global)
            if (role === 'guest' && view !== 'login' && view !== 'register') {
                console.log('[NAVIGATE DEBUG] Guest trying to access protected view:', view);
                app.showToast('Faça login para continuar.');
                view = 'login';
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

                // Show School/Professor Link (Sidebar)
                app.updateSidebarVisibility();
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
                app.loadClassroom(param);
            } else if (view === 'profile') {
                app.loadProfile();
            }
        },

        loadClassroom: async (classroomId) => {
            console.log("Loading Classroom:", classroomId);
            app.state.currentClassroom = classroomId;

            // Garantir que estamos na view certa
            if (app.state.currentView !== 'classroom') return;

            const container = document.getElementById('classroom-active-area');
            const joinArea = document.getElementById('classroom-join-area');

            if (joinArea) joinArea.classList.add('hidden');
            if (container) container.classList.remove('hidden');

            const isProfessor = app.state.user && ['professor', 'school', 'admin'].includes(app.state.user.role);

            // Renderizar estrutura base da sala
            const renderLayout = () => {
                container.innerHTML = `
                    <div class="flex flex-col lg:flex-row h-screen max-h-screen overflow-hidden">
                        <!-- HEADER MOBILE -->
                        <div class="lg:hidden bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
                             <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                <span class="font-mono text-white font-bold tracking-widest">${classroomId}</span>
                             </div>
                             <button onclick="app.navigate('home')" class="text-slate-400"><span class="material-icons-round">close</span></button>
                        </div>

                        <!-- MAIN CONTENT (CIFRA) -->
                        <div class="flex-1 bg-white dark:bg-slate-900 relative overflow-y-auto flex flex-col" id="classroom-main-stage">
                            
                            <!-- Top Bar (Sala Info) -->
                            <div class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center sticky top-0 z-20">
                                <div>
                                    <h2 class="font-bold text-slate-800 dark:text-white text-lg leading-tight" id="classroom-music-title">Aguardando música...</h2>
                                    <p class="text-xs text-slate-500 dark:text-slate-400" id="classroom-music-artist">-</p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div id="classroom-tone-badge" class="hidden px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg font-bold text-slate-700 dark:text-white"></div>
                                    ${isProfessor ? `
                                    <button onclick="app.openClassroomManager()" class="bg-primary hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2">
                                        <span class="material-icons-round">library_music</span> <span class="hidden sm:inline">Selecionar Música</span>
                                    </button>
                                    ` : ''}
                                </div>
                            </div>

                            <!-- Cifra Content -->
                            <div id="classroom-cifra-content" class="p-4 md:p-8 max-w-4xl mx-auto w-full text-center text-slate-400">
                                <div class="py-20">
                                    <span class="material-icons-round text-6xl opacity-20 mb-4">music_off</span>
                                    <p class="text-lg">O professor ainda não selecionou uma música.</p>
                                </div>
                            </div>
                        </div>

                        <!-- SIDEBAR (Chat/Participants/Controls) -->
                        <div class="w-full lg:w-80 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 h-64 lg:h-auto">
                            <div class="p-4 border-b border-slate-700 bg-slate-900/50">
                                <div class="flex items-center justify-between mb-2">
                                    <h3 class="font-bold text-white text-sm uppercase tracking-wider">Sala de Aula</h3>
                                    <span class="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30 flex items-center gap-1">
                                        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> AO VIVO
                                    </span>
                                </div>
                                <div class="flex items-center justify-between bg-slate-800 p-2 rounded-lg border border-slate-700">
                                    <span class="font-mono text-white font-bold tracking-widest text-lg">${classroomId}</span>
                                    <button onclick="navigator.clipboard.writeText('${classroomId}'); app.showToast('Código copiado!')" class="text-slate-400 hover:text-white">
                                        <span class="material-icons-round text-sm">content_copy</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Participants List -->
                            <div class="flex-1 overflow-y-auto p-4 space-y-3">
                                <p class="text-xs font-bold text-slate-500 uppercase">Participantes (<span id="classroom-count">0</span>)</p>
                                <div id="classroom-participants" class="space-y-2">
                                    <!-- Injected -->
                                </div>
                            </div>

                            <!-- Footer Actions -->
                            <div class="p-4 bg-slate-900 border-t border-slate-700 space-y-2">
                                ${isProfessor ? `
                                <button onclick="app.closeClassroom('${classroomId}')" class="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                                    <span class="material-icons-round">power_settings_new</span> Encerrar Sala
                                </button>
                                ` : `
                                <button onclick="app.leaveClassroom()" class="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl font-bold transition-all">
                                    Sair da Sala
                                </button>
                                `}
                            </div>
                        </div>
                    </div>
                `;
            };

            renderLayout();

            // Lógica Realtime (Firestore Listener)
            if (app.unsubs.classroom) app.unsubs.classroom(); // Clear previous

            try {
                // Listener 1: Sala DOC (Status e Música)
                app.unsubs.classroom = app.db.collection('classrooms').doc(classroomId)
                    .onSnapshot(doc => {
                        if (!doc.exists) {
                            app.showToast('Sala não encontrada ou encerrada.');
                            app.leaveClassroom();
                            return;
                        }
                        const data = doc.data();

                        if (data.status === 'closed') {
                            alert('A aula foi encerrada pelo professor.');
                            app.leaveClassroom();
                            return;
                        }

                        // Atualizar Música
                        const contentArea = document.getElementById('classroom-cifra-content');
                        const titleEl = document.getElementById('classroom-music-title');
                        const artistEl = document.getElementById('classroom-music-artist');
                        const badge = document.getElementById('classroom-tone-badge');

                        if (data.currentMusic) {
                            if (titleEl) titleEl.innerText = data.currentMusic.title;
                            if (artistEl) artistEl.innerText = data.currentMusic.artist || 'Artista Desconhecido';

                            if (badge) {
                                badge.innerText = data.currentMusic.tone || '?';
                                badge.classList.remove('hidden');
                            }

                            // Renderizar Conteúdo (Simplificado)
                            if (contentArea) {
                                // Usar formatador se disponível, senão texto simples
                                // Aqui assumimos que content já vem formatado HTML ou texto cru
                                // Para segurança, ideal usar innerText se for cru, ou sanitizer se HTML
                                // No app.js original, vimos App.transpose gerando HTML seguro com spans.
                                // Vamos assumir que data.currentMusic.htmlContent é gerado pelo professor ao selecionar

                                contentArea.innerHTML = data.currentMusic.htmlContent || `<pre class="font-mono whitespace-pre-wrap text-left text-slate-800 dark:text-slate-300 text-sm md:text-base">${data.currentMusic.content}</pre>`;
                                contentArea.scrollTop = 0;
                            }
                        } else {
                            // Reset
                            if (titleEl) titleEl.innerText = "Aguardando música...";
                            if (contentArea) contentArea.innerHTML = '<div class="py-20 flex flex-col items-center"><span class="material-icons-round text-6xl opacity-20 mb-4">queue_music</span><p>O professor está selecionando o repertório.</p></div>';
                        }

                    }, err => {
                        console.error("Erro Sala:", err);
                        // app.showToast('Erro de conexão com a sala.');
                    });

                // Listener 2: Participantes (Subcoleção Realtime)
                const participantsRef = app.db.collection('classrooms').doc(classroomId).collection('participants');

                app.unsubs.participants = participantsRef.orderBy('joinedAt', 'desc').onSnapshot(snapshot => {
                    const countEl = document.getElementById('classroom-count');
                    const listEl = document.getElementById('classroom-participants');

                    if (countEl) countEl.innerText = snapshot.size;

                    if (listEl) {
                        listEl.innerHTML = ''; // Limpar lista

                        if (snapshot.empty) {
                            listEl.innerHTML = `<p class="text-xs text-slate-500 text-center py-2">Nenhum participante ainda.</p>`;
                        }

                        snapshot.forEach(doc => {
                            const p = doc.data();
                            const isMe = (app.state.user && app.state.user.uid === p.userId) || (p.name === localStorage.getItem('guestName'));
                            // Note: guestName storage is heuristic if userId missing. Better would be storing participantId locally on join.

                            const div = document.createElement('div');
                            div.className = `flex items-center gap-3 p-2 rounded ${isMe ? 'bg-slate-700/50 border border-emerald-500/30' : 'bg-slate-800 hover:bg-slate-700 transition-colors'}`;

                            // Avatar logic
                            const initials = p.name ? p.name.substring(0, 2).toUpperCase() : '??';

                            div.innerHTML = `
                                <div class="w-8 h-8 rounded-full ${isMe ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-600 text-slate-300'} flex items-center justify-center font-bold text-xs">
                                    ${initials}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-bold ${isMe ? 'text-emerald-400' : 'text-slate-300'} truncate">
                                        ${p.name} ${isMe ? '(Você)' : ''}
                                    </p>
                                    <p class="text-[10px] text-slate-500 uppercase">${p.type === 'student' ? 'Aluno' : 'Visitante'}</p>
                                </div>
                            `;
                            listEl.appendChild(div);
                        });
                    }
                }, err => {
                    console.error("Erro Participantes:", err);
                });

            } catch (e) {
                console.error(e);
            }
        },

        leaveClassroom: () => {
            if (app.unsubs.classroom) {
                app.unsubs.classroom();
                app.unsubs.classroom = null;
            }
            app.navigate('home');
            location.reload(); // Hard reset para limpar estados visuais
        },

        closeClassroom: async (id) => {
            if (!confirm('Encerrar aula para todos?')) return;
            try {
                await fetch(`${app.API_URL}/api/classrooms/${id}/close`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                // Snapshot vai lidar com o redirect
            } catch (e) {
                alert('Erro ao encerrar: ' + e.message);
            }
        },

        // Gestor de Repertório dentro da Sala (Professor)
        openClassroomManager: () => {
            const userId = app.state.user.uid;
            app.modal({
                title: 'Selecionar Música',
                content: `<div id="classroom-repo-list" class="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">Carregando...</div>`,
                cancelText: 'Fechar',
                confirmText: null,
                onShow: async () => {
                    const list = document.getElementById('classroom-repo-list');
                    const snap = await app.db.collection('cifras').where('userId', '==', userId).get();
                    list.innerHTML = '';
                    snap.forEach(doc => {
                        const c = doc.data();
                        const item = document.createElement('div');
                        item.className = 'p-3 bg-slate-50 dark:bg-slate-700 rounded-lg flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-all';
                        item.innerHTML = `<div><p class="font-bold text-sm">${c.musicName}</p><p class="text-xs opacity-70">${c.artistName}</p></div> <span class="material-icons-round text-primary">play_circle</span>`;
                        item.onclick = () => app.setClassroomMusic(c);
                        list.appendChild(item);
                    });
                }
            });
        },

        setClassroomMusic: async (cifraData) => {
            // Formatar conteúdo com HTML básico para cor/acordes se necessário
            // Para MVP, enviar raw content e htmlContent pré-processado simples

            // Simular HTML generation básica (mesma lógica do transpose preview)
            let html = cifraData.content;
            // ... (Aqui poderia usar o Transposer para gerar HTML bonitinho)

            try {
                // Update via API ou Direto Firestore (Como permitido nas regras)
                // Usando direto no Firestore é mais rápido para "realtime feeling"
                await app.db.collection('classrooms').doc(app.state.currentClassroom).update({
                    currentMusic: {
                        title: cifraData.musicName,
                        artist: cifraData.artistName,
                        tone: cifraData.tom,
                        content: cifraData.content,
                        // htmlContent: ...
                    }
                });
                // Fechar modal
                const modal = document.querySelector('.modal-active');
                if (modal) modal.querySelector('.btn-outline').click(); // trigger cancel/close

            } catch (e) {
                alert('Erro ao mudar música: ' + e.message);
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

        login: async (e) => {
            e.preventDefault();
            const form = e.target;
            const btn = form.querySelector('button[type="submit"]');

            try {
                if (btn) {
                    btn.disabled = true;
                    btn.innerText = 'Entrando...';
                }

                const email = form.email.value;
                const password = form.password.value;

                // 1. Firebase Auth
                const userCredential = await app.auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 2. Fetch User Profile (Firestore)
                let userData = null;

                // Hybrid DB Support
                let dbUtils = (window.firestoreBridge && window.firestoreBridge.utils) ? window.firestoreBridge.utils : window.firestoreUtils;

                if (app.namedDb && dbUtils) {
                    const { doc, getDoc } = dbUtils;
                    const snap = await getDoc(doc(app.namedDb, 'users', user.uid));
                    if (snap.exists()) userData = snap.data();
                } else {
                    const doc = await app.db.collection('users').doc(user.uid).get();
                    if (doc.exists) userData = doc.data();
                }

                if (!userData) {
                    // Fallback for old users without profile doc?
                    userData = {
                        uid: user.uid,
                        email: user.email,
                        name: user.displayName || 'Usuário',
                        role: 'student', // Default
                        plan_id: 1
                    };
                }

                // 3. Save State & Storage
                app.state.user = userData;
                localStorage.setItem('token', await user.getIdToken());
                localStorage.setItem('user', JSON.stringify(userData));

                app.showToast(`Bem-vindo de volta, ${userData.name}!`);

                // 4. Redirect
                // Check if there is a pending classroom join
                const pendingClassroom = localStorage.getItem('pendingClassroom');
                if (pendingClassroom) {
                    console.log('[LOGIN] Redirecting to pending classroom:', pendingClassroom);
                    localStorage.removeItem('pendingClassroom');
                    app.navigate('classroom', pendingClassroom);
                    return;
                }

                if (userData.role === 'admin') app.navigate('admin');
                // else if (userData.role === 'school') app.navigate('school'); // CHANGED: Professor goes to Home
                else app.navigate('home');

            } catch (error) {
                console.error('Login Error:', error);
                app.showToast('Login falhou: ' + error.message);
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Entrar na conta';
                }
            }
        },

        redirectToLogin: () => {
            if (app.state.pendingClassroomId) {
                localStorage.setItem('pendingClassroom', app.state.pendingClassroomId);
            }
            app.hideJoinClassroomModal();
            app.navigate('login');
        },

        register: async (e) => {
            e.preventDefault();

            // Ensure clean slate if registering
            if (app.state.user) {
                if (!confirm('Você já está logado. Deseja sair para criar uma nova conta?')) return;
                app.logout();
            }

            const form = e.target;
            // Button feedback
            const btn = form.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.innerText = 'Processando...';
            }

            try {
                const email = form.email.value;
                const password = form.password.value;
                const name = form.name.value;
                const type = form.type.value;

                if (!email || !password || !name) throw new Error('Preencha os campos obrigatórios.');

                // Determine Role & Plan
                let role = 'student';
                let plan_id = 1;

                if (type === 'student') { role = 'student'; plan_id = 1; }
                else if (type.includes('professor')) {
                    role = 'school'; // Fix: Professors act as schools/admins in logic
                    if (type === 'professor_start') plan_id = 2; // Fixed Mapping
                    if (type === 'professor_pro') plan_id = 3;
                    if (type === 'professor_elite') plan_id = 4;
                } else if (type.includes('school')) {
                    role = 'school';
                    plan_id = 5;
                }

                // 1. Save Draft State (Client-Side Trust Flow)
                const draftData = {
                    email, password, name, role, plan_id,
                    phone: form.phone.value || '',
                    cpf: form.cpf.value || '',
                    instrument: form.instrument.value || ''
                };

                localStorage.setItem('pending_registration_data', JSON.stringify(draftData));

                // 2. Show Default Payment Modal
                const paymentLink = 'https://invoice.infinitepay.io/plans/saulo-diogo/1nBPlUHLod';

                const content = `
                <div class="text-center space-y-4">
                    <div class="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100">
                        <p class="text-lg font-bold">Confirmação de Pagamento</p>
                        <p class="text-sm mt-1">Para ativar seu acesso, realize o pagamento.</p>
                    </div>

                    <div class="bg-white p-6 border border-slate-200 rounded-xl">
                        <a href="${paymentLink}" target="_blank" class="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg shadow-md mb-4 flex items-center justify-center gap-2">
                            <span class="material-icons-round">payment</span>
                            Ir para Pagamento (Pix/Card)
                        </a>
                        <p class="text-xs text-slate-400">Abre em nova aba</p>
                    </div>

                    <div class="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-100">
                        <p class="font-bold">Já realizou o pagamento?</p>
                        <p class="mt-1">Clique no botão abaixo para liberar seu acesso imediatamente.</p>
                    </div>
                </div>
            `;

                app.modal({
                    title: 'Etapa Final 🚀',
                    content: content,
                    confirmText: 'Já Paguei / Liberar Acesso',
                    cancelText: 'Cancelar',
                    onConfirm: async () => {
                        await app.finishRegistration();
                    }
                });

                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Criar Conta';
                }

            } catch (error) {
                console.error(error);
                app.showToast('Erro: ' + error.message);
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Criar Conta';
                }
            }
        },

        finishRegistration: async () => {
            try {
                app.showToast('Criando sua conta... 🚀');

                const rawData = localStorage.getItem('pending_registration_data');
                if (!rawData) throw new Error('Dados de cadastro perdidos. Tente novamente.');

                const data = JSON.parse(rawData);

                // 1. Create Auth User
                const userCredential = await app.auth.createUserWithEmailAndPassword(data.email, data.password);
                const user = userCredential.user;
                await user.updateProfile({ displayName: data.name });

                // 2. Save Firestore Profile
                const userData = {
                    uid: user.uid,
                    name: data.name,
                    email: data.email,
                    role: data.role,
                    plan_id: data.plan_id,
                    cpf: data.cpf || '',
                    phone: data.phone || '',
                    instrument: data.instrument || '',
                    status: 'active', // ATIVAÇÃO IMEDIATA (Client-Side Trust)
                    createdAt: new Date().toISOString(),
                    paymentUpdated: new Date().toISOString()
                };

                // Hybrid DB Support (Electron Bridge vs Web)
                let dbUtils = (window.firestoreBridge && window.firestoreBridge.utils) ? window.firestoreBridge.utils : window.firestoreUtils;

                if (app.namedDb && dbUtils) {
                    const { doc, setDoc } = dbUtils;
                    await setDoc(doc(app.namedDb, 'users', user.uid), userData);
                } else {
                    await app.db.collection('users').doc(user.uid).set(userData);
                }

                app.showToast(`Bem-vindo, ${data.name}!`);
                localStorage.removeItem('pending_registration_data');

                // Auto Login / Redirect
                app.state.user = userData;

                if (userData.role === 'admin') app.navigate('admin');
                else if (userData.role === 'school') app.navigate('school');
                else app.navigate('home');

            } catch (error) {
                console.error('Registration Error:', error);
                if (error.code === 'auth/email-already-in-use') {
                    app.showToast('Este email já está cadastrado.');
                } else {
                    app.showToast('Erro ao finalizar cadastro: ' + error.message);
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
            console.log('Import feature disabled.');
        },



        saveCifra: async (e) => {
            e.preventDefault();
            console.log('Save feature disabled.');
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

        getRoleBadge: (role) => {
            const badges = {
                'student': '<span class="px-2 py-1 rounded bg-blue-50 text-blue-600 text-[10px] font-bold uppercase border border-blue-100">Estudante</span>',
                'professor': '<span class="px-2 py-1 rounded bg-purple-50 text-purple-600 text-[10px] font-bold uppercase border border-purple-100">Professor</span>',
                'school': '<span class="px-2 py-1 rounded bg-orange-50 text-orange-600 text-[10px] font-bold uppercase border border-orange-100">Escola</span>',
                'admin': '<span class="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold uppercase border border-slate-600">Admin</span>'
            };
            return badges[role] || `<span class="text-xs uppercase">${role}</span>`;
        },

        modalAddUser: async () => {
            const planOptions = app.PLANS.map(p => `<option value="${p.id}">${p.name} - R$ ${p.price}</option>`).join('');

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
            console.log('Editando usuário ID:', id);

            try {
                // Fetch directly from Firestore (or use cached if optimal, but fetch is safer for fresh data)
                let user;
                if (app.namedDb && window.firestoreUtils) {
                    const { doc, getDoc } = window.firestoreUtils;
                    const snap = await getDoc(doc(app.namedDb, 'users', id));
                    if (snap.exists()) user = { id: snap.id, ...snap.data() };
                } else {
                    const snap = await app.db.collection('users').doc(id).get();
                    if (snap.exists) user = { id: snap.id, ...snap.data() };
                }

                if (!user) return alert('Usuário não encontrado.');

                const planOptions = app.PLANS.map(p => `
                <option value="${p.id}" ${user.plan_id === p.id ? 'selected' : ''}>${p.name}</option>
            `).join('');

                const content = `
                <div class="space-y-4 text-left">
                     <div class="bg-slate-50 p-4 rounded-lg mb-4">
                        <p class="text-xs text-slate-400 uppercase font-bold">Usuário</p>
                        <p class="font-bold text-lg">${user.name || 'Sem nome'}</p>
                        <p class="text-sm text-slate-500">${user.email}</p>
                     </div>
                     
                     <div>
                        <label class="block text-sm font-bold mb-1">Status da Conta</label>
                        <select id="edit-user-status" class="w-full rounded border-slate-300 p-2">
                            <option value="active" ${user.status === 'active' ? 'selected' : ''}>✅ Ativo</option>
                            <option value="suspended" ${user.status !== 'active' ? 'selected' : ''}>🚫 Suspenso / Inadimplente (Bloquear Acesso)</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold mb-1">Perfil (Role)</label>
                            <select id="edit-user-role" class="w-full rounded border-slate-300 p-2">
                                <option value="student" ${user.role === 'student' ? 'selected' : ''}>Aluno</option>
                                <option value="professor" ${user.role === 'professor' ? 'selected' : ''}>Professor</option>
                                <option value="school" ${user.role === 'school' ? 'selected' : ''}>Escola</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold mb-1">Alterar Plano</label>
                            <select id="edit-user-plan" class="w-full rounded border-slate-300 p-2">
                                <option value="">Sem Plano</option>
                                ${planOptions}
                            </select>
                        </div>
                    </div>
                    
                    <div class="pt-4 border-t mt-4">
                        <p class="text-xs text-slate-400 mb-2">Opções Avançadas</p>
                        <button onclick="app.deleteUser('${user.id}')" class="text-red-500 text-xs font-bold hover:underline">EXCLUIR USUÁRIO PERMANENTEMENTE</button>
                    </div>
                </div>
            `;

                await app.modal({
                    title: 'Gerenciar Usuário',
                    content: content,
                    confirmText: 'Salvar Alterações',
                    onShow: () => {
                        // Same role/plan auto-complete logic if needed
                    },
                    onConfirm: async () => {
                        const status = document.getElementById('edit-user-status').value;
                        const role = document.getElementById('edit-user-role').value;
                        const plan_id = document.getElementById('edit-user-plan').value || null;

                        try {
                            const updateData = {
                                status,
                                role,
                                plan_id: parseInt(plan_id)
                            };

                            if (app.namedDb && window.firestoreUtils) {
                                const { doc, updateDoc } = window.firestoreUtils;
                                await updateDoc(doc(app.namedDb, 'users', id), updateData);
                            } else {
                                await app.db.collection('users').doc(id).update(updateData);
                            }

                            app.showToast('Usuário atualizado!');
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
                if (app.namedDb && window.firestoreUtils) {
                    const { doc, deleteDoc } = window.firestoreUtils;
                    await deleteDoc(doc(app.namedDb, 'users', id));
                } else {
                    await app.db.collection('users').doc(id).delete();
                }
                app.showToast('Usuário excluído.');
                // Refresh list
                app.loadAdminUsers();

                // Close modal by removing it from DOM
                const modal = document.querySelector('.fixed.inset-0.z-50');
                if (modal) modal.remove();
            } catch (e) {
                console.error(e);
                alert('Erro ao excluir: ' + e.message);
            }
        },

        deleteCifra: async (id) => {
            console.log('Delete feature disabled.');
        },

        // --- CLASSROOM MODULE ---
        // --- CLASSROOM MODULE ---

        // Professor: Criar Sala
        // createClassroom: () => app.startClassroom(), // REMOVED LEGACY DUPLICATE

        // Professor: Encerrar Sala
        startClassroom_OLD: async () => {
            console.log('Use new createClassroom implementation.');
        },

        // Professor: Encerrar Sala
        closeClassroom: async (code) => {
            if (!confirm('Tem certeza que deseja encerrar esta sala? Os alunos serão desconectados.')) return;

            try {
                const res = await fetch(`${app.API_URL}/classrooms/${code}/close`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (!res.ok) throw new Error('Falha ao encerrar');

                app.showToast('Sala encerrada com sucesso.');
                app.loadSchoolDashboard(); // Recarrega lista
            } catch (e) {
                alert(e.message);
            }
        },

        // Aluno/Visitante: Entrar na Sala
        joinClassroom: async (codeOverride = null, mode = 'guest') => {
            const codeInput = document.getElementById('classroom-code-input');
            const code = codeOverride || (codeInput ? codeInput.value.trim().toUpperCase() : null);

            if (!code) return alert('Digite o código');

            const btn = document.querySelector('#classroom-join-area button');
            if (btn) {
                btn.innerText = 'Verificando...';
                btn.disabled = true;
            }

            try {
                // Se for Visitante, pede nome antes se não tiver
                let guestName = null;
                if (!app.state.user) {
                    const nameInput = document.getElementById('guest-name-input'); // Se existir no DOM
                    guestName = nameInput ? nameInput.value : 'Visitante';
                }

                // 1. Validar via API
                const res = await fetch(`${app.API_URL}/api/classrooms/${code}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guestName })
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Erro ao entrar na sala');

                // 2. Sucesso API -> Iniciar UI de Sala
                console.log("Entrou na sala:", data);

                // Se foi navegação direta, o navigate já chamou loadClassroom
                // Se foi via modal, precisamos navegar
                if (app.state.currentView !== 'classroom') {
                    app.navigate('classroom', code);
                } else {
                    app.loadClassroom(code);
                }

            } catch (e) {
                app.modal({
                    title: 'Acesso Negado 🚫',
                    content: `<p class="text-center text-lg">${e.message}</p>`,
                    confirmText: 'OK'
                });
                if (btn) {
                    btn.innerText = 'Entrar na Aula';
                    btn.disabled = false;
                }
            }
        },

        joinAsGuest: () => {
            // Wrapper para o botão do modal
            app.joinClassroom(null, 'guest');
        },

        // --- FIRESTORE OPERATIONS ---

        loadCifras: async (containerId = 'cifra-list') => {
            console.log('Load Cifras DESATIVADO.');
            const list = document.getElementById(containerId);
            if (list) list.innerHTML = '';
        },

        filterCifras: () => {
            console.log('Filter Cifras DESATIVADO.');
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
        // --- SCHOOL CONTROLLER (Minhas Salas) ---
        loadSchoolDashboard_OLD: async () => {
            console.log('[SCHOOL DEBUG] Carregando Minhas Salas...');

            const list = document.getElementById('school-classrooms-list');
            // Elemento de "Vazio" pode estar dentro do grid ou separado, vamos assumir o padrão do HTML atual
            // No HTML atual, o empty state está hardcoded dentro do grid. Vamos limpar e gerenciar via JS.

            if (!list) return console.error('Lista de salas não encontrada no DOM');

            list.innerHTML = '<div class="col-span-full text-center py-12"><p class="text-slate-500">Carregando suas salas...</p></div>';

            try {
                const res = await fetch(`${app.API_URL}/classrooms`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });

                if (!res.ok) throw new Error('Falha ao buscar salas');

                const classrooms = await res.json();
                list.innerHTML = '';

                if (classrooms.length === 0) {
                    list.innerHTML = `
                        <div class="col-span-full text-center p-12 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                            <span class="material-icons-round text-4xl mb-2 opacity-50">meeting_room</span>
                            <p>Nenhuma sala criada ainda.</p>
                        </div>
                    `;
                    return;
                }

                classrooms.forEach(c => {
                    const statusColor = c.status === 'active' ? 'text-green-500' : 'text-red-500';
                    const statusLabel = c.status === 'active' ? 'Ativa' : 'Encerrada';

                    const card = document.createElement('div');
                    card.className = 'bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all group relative';

                    card.innerHTML = `
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-1 group-hover:text-primary transition-colors">${c.name}</h3>
                                <p class="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 inline-block">
                                    ${c.code}
                                </p>
                            </div>
                            <span class="flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${statusColor}">
                                <span class="w-2 h-2 rounded-full bg-current"></span> ${statusLabel}
                            </span>
                        </div>
                        
                        <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-6">
                            <span class="flex items-center gap-1"><span class="material-icons-round text-base">person</span> ${c.participantsCount || 0}</span>
                            <span class="flex items-center gap-1"><span class="material-icons-round text-base">schedule</span> ${new Date(c.createdAt._seconds * 1000).toLocaleDateString()}</span>
                        </div>

                        <div class="flex gap-2">
                            <button onclick="app.navigate('classroom', '${c.code}')" 
                                class="flex-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-white py-2 rounded-xl font-bold transition-colors">
                                Entrar
                            </button>
                            ${c.status === 'active' ? `
                            <button onclick="app.closeClassroom('${c.code}')" title="Encerrar Sala"
                                class="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors">
                                <span class="material-icons-round">block</span>
                            </button>
                            ` : ''}
                        </div>
                    `;
                    list.appendChild(card);
                });

            } catch (e) {
                console.error(e);
                list.innerHTML = `
                    <div class="col-span-full text-center py-12 text-red-500">
                        <span class="material-icons-round text-3xl mb-2">error_outline</span>
                        <p>Erro ao carregar salas.</p>
                        <p class="text-xs mt-2 opacity-70">${e.message}</p>
                    </div>
                `;
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
        },
        // --- NEW: PROFILE & CLASSROOMS ---

        loadProfile: async () => {
            let user = app.state.user;
            if (!user) return;

            // Fetch Fresh Data from Firestore
            try {
                app.showToast('Atualizando dados...');
                let dbUtils = (window.firestoreBridge && window.firestoreBridge.utils) ? window.firestoreBridge.utils : window.firestoreUtils;
                let freshUser = null;

                if (app.namedDb && dbUtils) {
                    const { doc, getDoc } = dbUtils;
                    const snap = await getDoc(doc(app.namedDb, 'users', user.uid));
                    if (snap.exists()) freshUser = snap.data();
                } else {
                    const docSnap = await app.db.collection('users').doc(user.uid).get();
                    if (docSnap.exists) freshUser = docSnap.data();
                }

                if (freshUser) {
                    app.state.user = { ...app.state.user, ...freshUser };
                    localStorage.setItem('user', JSON.stringify(app.state.user));
                    user = app.state.user;
                    console.log('[PROFILE] User data updated:', user);
                }
            } catch (e) {
                console.error('[PROFILE] Error fetching fresh data:', e);
            }

            // Populate Basic Info
            document.getElementById('profile-name').innerText = user.name || 'Usuário';
            document.getElementById('profile-email').innerText = user.email;
            document.getElementById('profile-role').innerText = (user.role || 'guest').toUpperCase();
            document.getElementById('profile-uid').innerText = user.uid;

            // Avatar
            const initials = (user.name || 'U').substring(0, 2).toUpperCase();
            document.getElementById('profile-avatar').innerText = initials;

            // Plan Detail
            const planMap = {
                1: 'Aluno (Grátis)',
                2: 'Professor Start',
                3: 'Professor Pro',
                4: 'Professor Elite',
                5: 'Escola Básica'
            };
            document.getElementById('profile-plan').innerText = planMap[user.plan_id] || 'Desconhecido';

            // Member Since
            const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A';
            document.getElementById('profile-since').innerText = date;

            // Atualizar sidebar com base nos dados novos
            app.updateSidebarVisibility();
        },

        updateSidebarVisibility: () => {
            const runCheck = () => {
                const sidebar = document.getElementById('sidebar-school-link');
                const homeCardSchool = document.getElementById('home-card-school');
                const homeAdminLink = document.getElementById('home-admin-link');

                const rawRole = (app.state.user && app.state.user.role) ? app.state.user.role : '';
                const userRole = rawRole.toLowerCase();

                console.log('[VISIBILITY UPDATE] Checking role:', userRole);

                // Lógica de Escola / Professor
                if (userRole === 'admin' || userRole.includes('school') || userRole.includes('professor')) {
                    if (sidebar) {
                        sidebar.classList.remove('hidden');
                        sidebar.style.display = 'flex';
                    }
                    if (homeCardSchool) {
                        homeCardSchool.classList.remove('hidden');
                        homeCardSchool.classList.add('block'); // ou flex/grid dependendo do layout, mas remove hidden já ajuda
                    }

                    // Legacy cleanup
                    const legacyHeader = document.getElementById('school-link-container');
                    if (legacyHeader) legacyHeader.classList.add('hidden');
                } else {
                    if (sidebar) {
                        // sidebar.classList.add('hidden'); // DISABLED: Forcing visibility per user request
                        // sidebar.style.display = 'none';
                    }
                    if (homeCardSchool) {
                        // homeCardSchool.classList.add('hidden');
                    }
                }

                // Lógica de Admin
                if (userRole === 'admin') {
                    if (homeAdminLink) homeAdminLink.classList.remove('hidden');
                } else {
                    if (homeAdminLink) homeAdminLink.classList.add('hidden');
                }
            };

            runCheck();
            // Retry safety for slow DOM updates
            setTimeout(runCheck, 100);
            setTimeout(runCheck, 500);
        },

        changePassword: async () => {
            const user = app.auth.currentUser;
            if (!user) {
                app.showToast('Erro: Usuário não identificado.');
                return;
            }
            if (confirm(`Deseja enviar um e-mail de redefinição de senha para ${user.email}?`)) {
                try {
                    await app.auth.sendPasswordResetEmail(user.email);
                    app.showToast('E-mail enviado! Verifique sua caixa de entrada (e spam).');
                } catch (error) {
                    console.error('Password Reset Error:', error);
                    app.showToast('Erro ao enviar e-mail: ' + error.message);
                }
            }
        },

        loadSchoolDashboard: async () => {
            // Customize View Based on Plan
            const user = app.state.user;
            const isSchool = user.plan_id === 5; // 5 = Escola Básico

            const titleEl = document.getElementById('school-page-title');
            const roleLabel = document.getElementById('school-role-label');
            const manageProfSection = document.getElementById('section-manage-professors');

            if (titleEl) {
                titleEl.innerHTML = isSchool
                    ? '<span class="material-icons-round text-blue-500">domain</span> Gestão de Salas'
                    : '<span class="material-icons-round text-purple-500">school</span> Painel do Professor';
            }
            if (roleLabel) {
                roleLabel.innerText = isSchool ? 'Escola' : 'Professor';
            }

            // Hide/Show Professor Management
            if (manageProfSection) {
                manageProfSection.style.display = isSchool ? 'block' : 'none';
            }

            // 1. Load Professors (Only if School)
            if (isSchool) {
                const list = document.getElementById('school-professors-list');
                const empty = document.getElementById('school-empty-state');
                if (list) {
                    list.innerHTML = '<tr><td colspan="5" class="text-center p-4">Carregando professores...</td></tr>';
                    // Mock or Fetch Logic here for Professors...
                    // For now, let's just clear checking it works
                    list.innerHTML = '';
                    if (empty) empty.classList.remove('hidden');
                }
            }

            // 2. Load Classrooms (Always)
            app.loadClassrooms();

            // 3. Load Repertoire (Professor View only)
            if (!isSchool) {
                app.loadCifras('school-cifras-list');
            }
        },

        loadClassrooms: async () => {
            const container = document.getElementById('school-classrooms-list');
            if (!container) return;

            try {
                // FIX: Ensure UID is available
                let uid = app.state.user ? app.state.user.uid : null;
                if (!uid && app.auth && app.auth.currentUser) {
                    uid = app.auth.currentUser.uid;
                    if (app.state.user) app.state.user.uid = uid; // Repair state
                }

                if (!uid) {
                    throw new Error("Usuário não identificado. Tente fazer login novamente.");
                }

                const snapshot = await app.db.collection('classrooms')
                    .where('schoolId', '==', uid)
                    .get();

                if (snapshot.empty) {
                    container.innerHTML = `
                    <div class="col-span-full text-center p-12 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <span class="material-icons-round text-4xl mb-2 opacity-50">meeting_room</span>
                        <p>Nenhuma sala criada ainda.</p>
                    </div>`;
                    return;
                }

                container.innerHTML = '';
                snapshot.forEach(doc => {
                    const room = doc.data();
                    const card = document.createElement('div');
                    card.className = "bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative group";
                    card.innerHTML = `
                    <div class="flex items-center justify-between mb-4">
                        <div class="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-bold text-xl">
                            ${(room.name || 'S').substring(0, 2).toUpperCase()}
                        </div>
                        <span class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 rounded-lg">Ativa</span>
                    </div>
                    <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-1">${room.name}</h3>
                    <p class="text-sm text-slate-500 mb-4">${room.studentCount || 0} Alunos</p>
                    
                    <div class="flex flex-col gap-2">
                        <button onclick="app.openClassroomManager('${doc.id}', '${room.name}')" class="w-full py-2 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                            Gerenciar Sala
                        </button>
                        <button onclick="app.copyClassroomLink('${doc.id}')" class="w-full py-2 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 font-bold text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-2">
                            <span class="material-icons-round text-sm">link</span> Enviar Link
                        </button>
                    </div>
                    
                    <button onclick="app.deleteClassroom('${doc.id}')" class="absolute top-4 right-4 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span class="material-icons-round">delete</span>
                    </button>
                `;
                    container.appendChild(card);
                });

            } catch (error) {
                console.error('Error loading classrooms:', error);
                container.innerHTML = '<p class="text-red-500">Erro ao carregar salas.</p>';
            }
        },

        copyClassroomLink: (id) => {
            // FIX: Support file:// protocol by using full href path
            const baseUrl = window.location.href.split('#')[0];
            const link = `${baseUrl}#classroom/${id}`;
            navigator.clipboard.writeText(link).then(() => {
                app.showToast('Link da sala copiado!');
            }).catch(err => {
                console.error('Erro ao copiar:', err);
                app.showToast('Erro ao copiar link.');
            });
        },

        createClassroom: async () => {
            const name = prompt("Nome da Nova Sala:");
            if (!name) return;

            try {
                // FIX: Ensure UID is available
                let uid = app.state.user ? app.state.user.uid : null;
                if (!uid && app.auth && app.auth.currentUser) {
                    uid = app.auth.currentUser.uid;
                    if (app.state.user) app.state.user.uid = uid; // Repair state
                }

                if (!uid) throw new Error("Usuário não autenticado corretamente.");

                await app.db.collection('classrooms').add({
                    schoolId: uid,
                    name: name,
                    studentCount: 0,
                    createdAt: new Date().toISOString()
                });
                app.showToast('Sala criada com sucesso!');
                app.loadClassrooms();
            } catch (error) {
                console.error(error);
                app.showToast('Erro ao criar sala.');
            }
        },

        deleteClassroom: async (id) => {
            if (!confirm('Tem certeza? Isso apagará a sala e todo o histórico.')) return;
            try {
                await app.db.collection('classrooms').doc(id).delete();
                app.showToast('Sala removida!');
                app.loadClassrooms();
            } catch (e) {
                console.error(e);
                app.showToast('Erro ao remover sala.');
            }
        },

        // --- LIVE CLASSROOM MANAGER LOGIC ---
        openClassroomManager: (id, name) => {
            const dashboard = document.getElementById('section-manage-professors');
            const liveManager = document.getElementById('section-live-manager');
            const title = document.getElementById('live-manager-title');

            if (dashboard && liveManager) {
                dashboard.classList.add('hidden');
                liveManager.classList.remove('hidden');
                if (title) title.innerText = `Gerenciando: ${name}`;

                // Load Repertoire specifically for this view
                app.loadCifras('live-manager-cifras-list');

                // TODO: Load Connected Students
                // app.loadConnectedStudents(id);
            }
        },

        closeClassroomManager: () => {
            const dashboard = document.getElementById('section-manage-professors');
            const liveManager = document.getElementById('section-live-manager');

            if (dashboard && liveManager) {
                liveManager.classList.add('hidden');
                dashboard.classList.remove('hidden');
            }
        },

        // --- CLASSROOM JOIN LOGIC ---
        showJoinClassroomModal: (classroomId) => {
            console.log('[MODAL] showJoinClassroomModal called with ID:', classroomId);
            app.state.pendingClassroomId = classroomId;
            const modal = document.getElementById('join-classroom-modal');
            console.log('[MODAL] Modal element found:', modal);
            if (modal) {
                modal.classList.add('active');
                modal.style.pointerEvents = 'all';
                modal.style.opacity = '1';
                console.log('[MODAL] Modal should now be visible!');
            } else {
                console.error('[MODAL] ERROR: Modal element not found in DOM!');
            }
        },

        hideJoinClassroomModal: () => {
            const modal = document.getElementById('join-classroom-modal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.pointerEvents = 'none';
                modal.style.opacity = '0';
            }
        },

        joinAsGuest: () => {
            const nameInput = document.getElementById('guest-name-input');
            const guestName = nameInput ? nameInput.value.trim() : '';

            if (!guestName) {
                app.showToast('Por favor, digite seu nome.');
                if (nameInput) nameInput.focus();
                return;
            }

            // Create temporary guest user
            app.state.user = {
                uid: 'guest_' + Date.now(),
                name: guestName,
                role: 'guest',
                email: 'visitante@cifraprox.com',
                isGuest: true
            };

            // Persist guest name for convenience
            localStorage.setItem('guestName', guestName);

            app.hideJoinClassroomModal();
            app.hideJoinClassroomModal();
            // Store the classroom ID to redirect after login
            localStorage.setItem('pendingClassroom', app.state.pendingClassroomId);
            app.navigate('login');
        },

        joinClassroom: async (classroomId, userType) => {
            console.log('[JOIN CLASSROOM]', classroomId, userType);

            try {
                // Load classroom data
                const classroomDoc = await app.db.collection('classrooms').doc(classroomId).get();

                if (!classroomDoc.exists) {
                    app.showToast('Sala não encontrada (ID inválido ou excluído).');
                    // app.navigate('home'); // REMOVIDO: Evita redirecionar para login se for guest

                    // Mostrar erro na tela
                    document.getElementById('app').innerHTML = `
                        <div class="min-h-screen flex flex-col items-center justify-center text-center p-4">
                            <h1 class="text-2xl font-bold text-red-500 mb-2">Sala não encontrada</h1>
                            <p class="text-slate-500 mb-4">O código da sala parece inválido ou a sala foi excluída.</p>
                            <button onclick="location.reload()" class="px-4 py-2 bg-slate-200 rounded-lg">Tentar Novamente</button>
                        </div>
                    `;
                    return;
                }

                const classroom = classroomDoc.data();
                app.state.currentClassroom = { id: classroomId, ...classroom };

                // Render student view
                app.renderStudentClassroomView();

                // TODO: Setup realtime listener for classroom updates
                // app.listenToClassroomUpdates(classroomId);

            } catch (error) {
                console.error('[JOIN CLASSROOM ERROR]', error);

                // Tratamento especial para erro de permissão
                if (error.code === 'permission-denied') {
                    document.getElementById('app').innerHTML = `
                        <div class="min-h-screen flex flex-col items-center justify-center text-center p-4">
                            <h1 class="text-2xl font-bold text-orange-500 mb-2">Acesso Negado</h1>
                            <p class="text-slate-500 mb-4">As regras de segurança do sistema impedem visitantes de ler os dados da sala.<br>
                            O administrador precisa liberar o acesso público na coleção 'classrooms'.</p>
                            <div class="bg-slate-100 p-4 rounded text-left text-xs font-mono mb-4 text-slate-600">
                                // Adicione isso ao firestore.rules:<br>
                                match /classrooms/{classroomId} { allow read: if true; }
                            </div>
                            <button onclick="app.showLoginFromJoin()" class="px-4 py-2 bg-purple-600 text-white rounded-lg">Fazer Login para Entrar</button>
                        </div>
                    `;
                } else {
                    app.showToast('Erro ao entrar na sala: ' + error.message);
                }
            }
        },

        renderStudentClassroomView: () => {
            const main = document.getElementById('app'); // MUDANÇA: Renderizar no #app pois #main não existe na rota direta
            if (!main) return;

            const classroom = app.state.currentClassroom;
            const userName = app.state.user.name || app.state.user.email || 'Visitante';

            main.innerHTML = `
            <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
                <nav class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 shadow-sm">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="font-display text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span class="material-icons-round text-purple-500">class</span>
                                ${classroom.name}
                            </h1>
                            <p class="text-xs text-slate-500">Conectado como: ${userName}</p>
                        </div>
                        <button onclick="app.leaveClassroom()" 
                            class="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors">
                            Sair
                        </button>
                    </div>
                </nav>

                <main class="flex-1 p-6 max-w-7xl mx-auto w-full">
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <!-- Main Content: Current Cifra -->
                        <div class="lg:col-span-2">
                            <div class="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700">
                                <div id="student-cifra-display" class="text-center py-20 text-slate-400">
                                    <span class="material-icons-round text-6xl mb-4 opacity-30">music_note</span>
                                    <p>Aguardando o professor selecionar uma música...</p>
                                </div>
                            </div>
                        </div>

                        <!-- Sidebar: Students List -->
                        <div class="lg:col-span-1">
                            <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700">
                                <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <span class="material-icons-round text-green-500">people</span>
                                    Alunos Online
                                </h3>
                                <div id="student-list-display" class="space-y-3">
                                    <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                        <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span class="text-sm font-medium text-slate-700 dark:text-white">${userName} (Você)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        `;
        },

        leaveClassroom: () => {
            app.state.currentClassroom = null;
            if (app.state.user && app.state.user.isGuest) {
                app.state.user = null;
                app.navigate('login');
            } else {
                app.navigate('home');
            }
        },
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
}  // End of initializeApp function
