window.app = {
    // --- STATE ---
    state: {
        user: null,
        currentView: 'home',
        currentCifra: null,
        currentTranspose: 0,
        metronome: {
            active: false,
            bpm: 120,
            interval: null
        },
        pendingClassroomId: null,
        mockClassrooms: null // Initialize as null, will be populated on first load fail
    },

    // --- CONFIG ---
    API_URL: 'https://us-central1-cifraprox-270126.cloudfunctions.net/app',
    // (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    //     ? 'http://localhost:5001/cifraprox/us-central1/app'
    //     : 'https://us-central1-cifraprox-270126.cloudfunctions.net/app',

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
    namedDb: null,
    ui: { app: null }, // Initialized in init

    // --- INIT ---
    init: async () => {
        console.log('[CORE] App Initializing...');

        // 0. UI Reference
        app.ui.app = document.getElementById('app');

        // 1. Initialize Firebase (Compat)
        if (typeof firebase === 'undefined') {
            console.error("[CORE] Critical Error: Firebase SDK not loaded.");
            return;
        }

        if (!firebase.apps.length) {
            console.log("[CORE] Initializing Firebase Compat...");
            firebase.initializeApp(app.firebaseConfig);
        } else {
            console.log("[CORE] Firebase Compat already initialized.");
        }

        // 2. Initialize Bridge (Modular/Named DB) - Replicating app_v2.js logic
        console.log('[CORE] Verificando Bridge...');
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds

        while (!window.firestoreBridge && !window.connectToNamedDB && !window.firestoreUtils && attempts < maxAttempts) {
            if (attempts % 10 === 0) console.log(`[CORE] Aguardando Bridge... (${attempts}/${maxAttempts})`);
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (window.connectToNamedDB || window.firestoreUtils) {
            console.log(`[CORE] Bridge carregada após ${attempts} tentativas.`);
            try {
                console.log('[CORE] Conectando ao Banco Nomeado via Bridge...');
                // Initialize Modular SDK via Bridge
                if (window.connectToNamedDB) {
                    app.namedDb = window.connectToNamedDB(app.firebaseConfig, 'cifraprox');
                    console.log('[CORE] Named DB (Modular) initialized via Bridge.');
                }
            } catch (e) {
                console.error('[CORE] Erro ao conectar Bridge:', e);
            }
        } else {
            console.warn('[CORE] AVISO: Bridge TIMEOUT (10s). O banco de dados pode não funcionar corretamente.');
        }

        // 3. Set Compat Instance (Used by App Modules)
        // Note: app_v2.js used firebase.firestore() (Compat) as the main app.db
        // connecting the Bridge side-by-side might be required for the backend to accept the specific DB ID?
        app.db = firebase.firestore();
        app.auth = firebase.auth();

        // Emulators setup
        if (window.location.hostname === "localhost") {
            console.log("Localhost detected.");
            // app.db.useEmulator("localhost", 8080);
            // app.auth.useEmulator("http://localhost:9099");
        }

        // 4. Auth Listener
        app.auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('User logged in:', user.uid);

                // Fetch extra user data
                try {
                    const doc = await app.db.collection('users').doc(user.uid).get();
                    if (doc.exists) {
                        app.state.user = doc.data();
                        app.state.user.uid = user.uid; // Ensure UID is present
                    } else {
                        // Fallback if user doc doesn't exist yet
                        app.state.user = {
                            uid: user.uid,
                            email: user.email,
                            name: user.displayName || 'Usuário',
                            role: 'student' // default
                        };
                    }
                } catch (e) {
                    console.error("Error fetching user data:", e);
                    app.state.user = { uid: user.uid, email: user.email };
                }

                app.updateHeader();

                // Fix: Reload dashboard if on school view (Race Condition Fix)
                if (app.state.currentView === 'school') {
                    app.loadSchoolDashboard();
                } else if (app.state.currentView === 'classroom' && app.state.currentClassroomCode) {
                    console.log('Auth restored, reloading Classroom View...');
                    app.loadClassroom(app.state.currentClassroomCode);
                }

                app.state.user = null;

                // CHECK FOR GUEST SESSION (Offline/Mock)
                const guestSession = localStorage.getItem('guest_session');
                if (guestSession) {
                    try {
                        const guestUser = JSON.parse(guestSession);
                        if (guestUser && guestUser.isGuest) {
                            console.log('[CORE] Guest session restored:', guestUser.name);
                            app.state.user = guestUser;
                        }
                    } catch (e) {
                        console.error('[CORE] Failed to parse guest session', e);
                        localStorage.removeItem('guest_session');
                    }
                }

                app.updateHeader();
            }
        });

        // 3. Router / Navigation
        window.addEventListener('hashchange', () => app.handleHashChange());
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view) {
                app.navigate(e.state.view, e.state.param, false);
            } else {
                app.handleHashChange();
            }
        });

        // 4. Initial Load
        app.handleHashChange();

        // 5. Global Event Listeners (e.g., input masks)
        // (Add if needed)
    },

    handleHashChange: () => {
        const hash = window.location.hash.substring(1);
        if (!hash) {
            app.navigate('home', null, false);
            return;
        }

        const parts = hash.split('/');
        const view = parts[0];
        const param = parts[1];

        app.navigate(view, param, false);
    },

    navigate: (view, param = null, addToHistory = true) => {
        console.log(`[NAVIGATE] To: ${view}, Param: ${param}`);

        // Handle History
        if (addToHistory) {
            const hash = param ? `#${view}/${param}` : `#${view}`;
            history.pushState({ view, param }, null, hash);
        }

        // Auth Guards
        const protectedViews = ['school', 'admin', 'profile'];
        if (protectedViews.includes(view) && !app.state.user) {
            console.log('[NAVIGATE] Protected view, redirecting to login...');
            app.navigate('login', null, false); // Redirect, replace history?
            return;
        }

        // Admin Guard
        if (view === 'admin' && app.state.user && app.state.user.role !== 'admin') {
            app.showToast('Acesso negado.');
            app.navigate('home', null, false);
            return;
        }

        // Update State
        app.state.currentView = view;

        // Render Template
        const appContainer = document.getElementById('app');
        const template = document.getElementById('view-' + view);

        if (template) {
            appContainer.innerHTML = '';
            const clone = template.content.cloneNode(true);
            appContainer.appendChild(clone);
            console.log(`[NAVIGATE] Rendered template: view-${view}`);
        } else {
            console.error(`[NAVIGATE] Template not found: view-${view}`);
            // Fallback?
            return;
        }

        // View Specific Logic (Post-Render)
        switch (view) {
            case 'home':
                app.loadCifras('cifra-list-home');
                break;

            case 'school':
                if (app.state.user) app.loadSchoolDashboard();
                break;

            case 'cifra':
                if (param) app.loadCifra(param); // Defined in app_cifras.js
                break;

            case 'classroom':
                // FIX: Intercept Unauthenticated Access
                if (!app.state.user && !app.state.user?.isGuest) {
                    console.log('[NAVIGATE] Classroom access intercepted. User not logged in.');
                    if (param) {
                        app.showJoinClassroomModal(param);
                    } else {
                        // Edge case: No param? Go home.
                        app.navigate('home', null, false);
                    }
                    return; // STOP EXECUTION (Do not load classroom view yet)
                }

                if (param) app.loadClassroom(param); // Defined in app_classroom.js
                break;

            case 'admin':
                if (app.loadAdminUsers) app.loadAdminUsers(); // Defined in app_admin.js
                break;

            case 'profile':
                if (app.role === 'admin') {
                    // ...
                }
                // Fill profile data
                if (app.state.user) {
                    setTimeout(() => { // Small delay to ensure DOM
                        document.getElementById('profile-name').textContent = app.state.user.name;
                        document.getElementById('profile-email').textContent = app.state.user.email;
                        document.getElementById('profile-role').textContent = app.state.user.role === 'admin' ? 'Administrador' : (app.state.user.role === 'school' ? 'Professor' : 'Membro');
                        document.getElementById('profile-uid').textContent = app.state.user.uid;
                        document.getElementById('profile-avatar').textContent = app.state.user.name.charAt(0).toUpperCase();
                        // Dates would need formatting
                    }, 50);
                }
                break;
        }

        // Re-attach global listeners or components if needed
        app.updateHeader();
    },

    updateHeader: () => {
        // Since header is now part of the template, we need to update the active header instance
        const user = app.state.user;
        const usernameDisplay = document.getElementById('header-username');
        const mobileToggle = document.getElementById('mobile-menu-toggle');

        if (usernameDisplay) {
            usernameDisplay.textContent = user ? user.name : 'Visitante';
        }

        // Update Sidebar Links Active State
        document.querySelectorAll('aside nav a').forEach(link => {
            if (link.getAttribute('onclick')?.includes(`'${app.state.currentView}'`)) {
                link.classList.add('bg-primary/10', 'text-primary');
                link.classList.remove('text-slate-500', 'dark:text-slate-400');
            } else {
                link.classList.remove('bg-primary/10', 'text-primary');
                link.classList.add('text-slate-500', 'dark:text-slate-400');
            }
        });

        // Show/Hide Admin Links
        const adminLinks = document.querySelectorAll('[id^="admin-link-container"]');
        adminLinks.forEach(el => {
            if (user && user.role === 'admin') {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
    }
};
