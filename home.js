// Standalone Home Logic for CifraProX

window.app = {
    state: {
        cifras: [],
        filteredCifras: []
    },

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

    init: async () => {
        console.log('[INIT] Iniciando Home Standalone...');

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(app.firebaseConfig);
        }

        // Wait for Bridge
        let attempts = 0;
        while (!window.connectToNamedDB && attempts < 50) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (window.connectToNamedDB) {
            app.db = window.connectToNamedDB(app.firebaseConfig, 'cifraprox');
            console.log('[INIT] Banco "cifraprox" conectado.');
            app.loadCifras();
        } else {
            console.error('[INIT] Falha ao carregar bridge do banco.');
        }

        app.updateThemeIcons();
    },

    toggleTheme: () => {
        const html = document.documentElement;
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        app.updateThemeIcons();
    },

    updateThemeIcons: () => {
        const icon = document.querySelector('.theme-icon');
        if (icon) {
            icon.innerText = document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode';
        }
    },

    loadCifras: () => {
        const { collection, query, orderBy, onSnapshot } = window.firestoreUtils;
        const q = query(collection(app.db, 'cifras'), orderBy('updatedAt', 'desc'));

        console.log('[LOAD] Iniciando listener de cifras...');
        onSnapshot(q, (snapshot) => {
            app.state.cifras = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`[LOAD] ${app.state.cifras.length} cifras carregadas.`);
            app.filterCifras();
        }, (error) => {
            console.error('[LOAD] Erro no listener:', error);
        });
    },

    filterCifras: () => {
        const queryText = document.getElementById('search-input').value.toLowerCase().trim();

        if (!queryText) {
            app.state.filteredCifras = app.state.cifras;
        } else {
            app.state.filteredCifras = app.state.cifras.filter(c =>
                c.title.toLowerCase().includes(queryText) ||
                c.artist.toLowerCase().includes(queryText)
            );
        }

        app.renderCifras();
    },

    renderCifras: () => {
        const list = document.getElementById('cifra-list');
        const empty = document.getElementById('empty-state');

        list.innerHTML = '';

        if (app.state.filteredCifras.length === 0) {
            list.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        list.classList.remove('hidden');
        empty.classList.add('hidden');

        app.state.filteredCifras.forEach(cifra => {
            const card = document.createElement('div');
            card.className = 'cifra-card p-6 rounded-3xl cursor-pointer group shadow-sm hover:shadow-xl transition-all';
            card.onclick = (e) => {
                // If clicked on an action button, don't trigger card click
                if (e.target.closest('.card-action')) return;
                alert(`Abrindo: ${cifra.title}`);
            };

            const genreIcon = app.getGenreIcon(cifra.genre);

            card.innerHTML = `
                <div class="flex justify-between items-start mb-6">
                    <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <span class="material-icons-round text-2xl">${genreIcon}</span>
                    </div>
                    <div class="flex gap-1">
                        <button class="card-action p-1 text-slate-300 hover:text-amber-400 transition-colors">
                            <span class="material-icons-round text-lg">star_outline</span>
                        </button>
                        <button class="card-action p-1 text-slate-300 hover:text-primary transition-colors">
                            <span class="material-icons-round text-lg">edit</span>
                        </button>
                    </div>
                </div>
                
                <h3 class="font-bold text-lg text-slate-800 dark:text-white capitalize group-hover:text-primary transition-colors mb-1 truncate">${cifra.title}</h3>
                <p class="text-slate-400 font-medium text-sm mb-6 truncate capitalize">${cifra.artist}</p>
                
                <div class="flex items-center gap-2">
                    <div class="px-2.5 py-1 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        ${cifra.tom || 'N/A'}
                    </div>
                    ${cifra.capo ? `
                        <div class="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-100/50 dark:border-blue-500/20 rounded-lg text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                            Capo
                        </div>
                    ` : ''}
                </div>
            `;
            list.appendChild(card);
        });
    },

    getGenreIcon: (genre) => {
        const icons = {
            'Sertanejo': 'agriculture',
            'Rock': 'rock_roller',
            'Pop': 'favorite',
            'MPB': 'brush',
            'Gospel': 'church',
            'Outros': 'music_note'
        };
        return icons[genre] || 'music_note';
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
    }
    app.init();
});
