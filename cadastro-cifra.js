// Standalone Song Registration Logic for CifraProX

// The "app" object to keep compatibility with extracted logic
window.app = {
    state: {
        currentVariations: {},
        availableTones: [],
        currentImportUrl: ''
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
        console.log('[INIT] Iniciando Cadastro de Cifras...');

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
        } else {
            console.error('[INIT] Falha ao carregar bridge do banco.');
        }

        app.updateThemeIcons();
        app.updatePreview();
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

    showToast: (message) => {
        console.log('[TOAST]', message);
        // Simple alert for now, or could implement a nicer toast
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[100] animate-bounce';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    slugify: (text) => {
        return text.toString().toLowerCase().trim()
            .replace(/&/g, 'e')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    importFromCifraClub: async (forcedUrl = null) => {
        const titleInput = document.getElementById('edit-title');
        const artistInput = document.getElementById('edit-artist');
        const title = titleInput.value.trim();
        const artist = artistInput.value.trim();

        if (!title || !artist) {
            app.showToast('Preencha o Título e o Artista primeiro.');
            return;
        }

        const btn = document.querySelector('button[onclick="app.importFromCifraClub()"]');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round text-lg animate-spin">refresh</span> Buscando...';
        btn.disabled = true;

        try {
            const artSlug = app.slugify(artist);
            const musSlug = app.slugify(title);
            const url = forcedUrl || `https://www.cifraclub.com.br/${artSlug}/${musSlug}/`;

            console.log(`[IMPORT] Iniciando busca para: ${url}`);

            let data;
            try {
                const proxyUrl1 = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&ts=${Date.now()}`;
                const response = await fetch(proxyUrl1);
                if (response.ok) {
                    const textResponse = await response.text();
                    data = JSON.parse(textResponse);
                } else {
                    throw new Error('Proxy 1 falhou');
                }
            } catch (err1) {
                const proxyUrl2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl2);
                if (response.ok) {
                    const rawHtml = await response.text();
                    data = { contents: rawHtml };
                } else {
                    throw new Error('Não foi possível conectar aos servidores de busca.');
                }
            }

            if (!data || !data.contents) throw new Error('Conteúdo não encontrado.');

            if (!forcedUrl) {
                const versions = app.parseCifraClubVersions(data.contents, url);
                if (versions.length > 1) {
                    app.showImportSelector(versions, (selectedUrl) => {
                        app.importFromCifraClub(selectedUrl);
                    });
                    btn.innerHTML = originalHTML;
                    btn.disabled = false;
                    return;
                }
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            let contentEl = doc.querySelector('pre') || doc.querySelector('.cifra_cnt');
            if (!contentEl) throw new Error('Cifra não encontrada.');

            let rawHtml = contentEl.innerHTML;
            rawHtml = rawHtml.replace(/<a[^>]*>|<\/a>/g, '');
            let formatted = rawHtml.replace(/<b>(.*?)<\/b>/g, '[$1]');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formatted;
            let finalContent = tempDiv.innerText;

            const tomEl = doc.getElementById('cifra_tom');
            let finalTom = "";
            if (tomEl) {
                const specificTom = tomEl.querySelector('b') || tomEl.querySelector('a') || tomEl;
                finalTom = specificTom.innerText.trim();
            }

            const sideTom = doc.querySelector('#side-tom ul') || doc.querySelector('.list-tones');
            let availableTones = [];
            if (sideTom) {
                availableTones = Array.from(sideTom.querySelectorAll('li, a'))
                    .map(li => li.innerText.trim())
                    .filter(t => t.length > 0 && !t.includes(' ½ Tom') && app.isActualChord(t));
            }

            let finalCapo = "";
            const capoEl = doc.getElementById('cifra_capo') || doc.querySelector('.cifra_capo');
            if (capoEl) {
                const match = capoEl.innerText.trim().match(/(\d+ª Casa)/i);
                finalCapo = match ? match[1] : "";
            }

            document.getElementById('edit-tom').value = finalTom;
            const capoSelect = document.getElementById('edit-capo');
            if (finalCapo) {
                let found = false;
                for (let opt of capoSelect.options) {
                    if (opt.value === finalCapo) { capoSelect.value = opt.value; found = true; break; }
                }
                if (!found) {
                    capoSelect.add(new Option(finalCapo, finalCapo));
                    capoSelect.value = finalCapo;
                }
            }

            const lines = finalContent.split('\n');
            let mainLines = [], tabLines = [], emptyBuffer = [];
            for (let line of lines) {
                const lineTrim = line.trim();
                if (lineTrim === "") { emptyBuffer.push(line); continue; }
                const isTab = /[a-zA-Z]?\|-/.test(line) || /-[-|0-9]{8,}/.test(line);
                const isTabHeading = /tab|solo|dedilhado|riff|baixo|intro/i.test(lineTrim);
                if (isTab || isTabHeading) {
                    tabLines.push(...emptyBuffer, line);
                    emptyBuffer = [];
                } else {
                    mainLines.push(...emptyBuffer, line);
                    emptyBuffer = [];
                }
            }

            const cleanMain = "[p|0|0|]\n\n" + mainLines.join('\n').trim();
            document.getElementById('edit-content').value = cleanMain;
            document.getElementById('edit-tabs').value = tabLines.join('\n').trim();

            let finalGenre = "";
            const genreEl = doc.querySelector('a[href*="/estilo/"]');
            if (genreEl) finalGenre = genreEl.innerText.trim();
            const genreSelect = document.getElementById('edit-genre');
            if (finalGenre) {
                let found = false;
                for (let opt of genreSelect.options) {
                    if (opt.value.toLowerCase() === finalGenre.toLowerCase()) { genreSelect.value = opt.value; found = true; break; }
                }
                if (!found) { genreSelect.add(new Option(finalGenre, finalGenre)); genreSelect.value = finalGenre; }
            }

            app.updatePreview();
            app.showToast('Importado!');

        } catch (e) {
            console.error(e);
            alert('Erro: ' + e.message);
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    },

    parseCifraClubVersions: (html, baseUrl) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const versions = [{ label: 'Principal', url: baseUrl, icon: 'queue_music', desc: 'Versão Completa' }];
        const pathPart = baseUrl.replace('https://www.cifraclub.com.br', '').split('?')[0].replace(/\/$/, '');

        const seen = new Set([baseUrl]);
        doc.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            if (!href || !href.includes(pathPart)) return;
            const fullUrl = href.startsWith('http') ? href : `https://www.cifraclub.com.br${href.startsWith('/') ? '' : '/'}${href}`;
            if (seen.has(fullUrl)) return;

            const text = a.innerText.toLowerCase();
            const labels = { 'simplificada': 'auto_fix_high', 'guitarra': 'electric_guitar', 'violão': 'music_note', 'baixo': 'speaker', 'teclado': 'piano' };
            for (let [key, icon] of Object.entries(labels)) {
                if (text.includes(key)) {
                    versions.push({ label: key.charAt(0).toUpperCase() + key.slice(1), url: fullUrl, icon, desc: 'Alternativa' });
                    seen.add(fullUrl);
                    break;
                }
            }
        });
        return versions;
    },

    showImportSelector: (versions, onSelect) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6">
                <h3 class="text-xl font-bold mb-4">Escolher Versão</h3>
                <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-2" id="versions-list"></div>
                <button onclick="this.closest('.fixed').remove()" class="w-full mt-4 py-2 text-slate-400 font-bold">CANCELAR</button>
            </div>
        `;
        const list = modal.querySelector('#versions-list');
        versions.forEach(v => {
            const btn = document.createElement('button');
            btn.className = 'w-full flex items-center gap-4 p-4 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-primary transition-all text-left';
            btn.innerHTML = `<span class="material-icons-round">${v.icon}</span> <div><div class="font-bold">${v.label}</div><div class="text-xs text-slate-400">${v.desc}</div></div>`;
            btn.onclick = () => { modal.remove(); onSelect(v.url); };
            list.appendChild(btn);
        });
        document.body.appendChild(modal);
    },

    isActualChord: (name) => {
        if (!name) return false;
        const clean = name.trim().toLowerCase();
        if (clean.includes('|') || clean.includes('.') || clean.startsWith('p|')) return false;
        const blacklist = ['intro', 'solo', 'riff', 'refrão', 'ponte', 'bridge', 'final', 'outro', 'instrumental', 'parte', 'pré-refrão', 'coro', 'batida', 'ritmo'];
        if (blacklist.some(term => clean.includes(term))) return false;
        if (clean.length > 10 || clean.includes(' ')) return false;
        return /^[A-G][#b]?/i.test(name.trim());
    },

    updatePreview: () => {
        const input = document.getElementById('edit-content');
        const preview = document.getElementById('edit-preview');
        if (!input || !preview) return;

        let content = input.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        content = content.replace(/\[p\|(\d*)(?:\|(\d*))?\|?\]\n?/g, (match, d1, d2) => {
            const delay = (d1 !== undefined && d1 !== '') ? parseInt(d1) : -1;
            const txt = delay === -1 ? 'Imediato' : (delay === 0 ? 'Desativado' : delay + 's');
            return `<div style="border-top: 1px dashed #10b981; color:#10b981; font-size:0.75rem; padding: 2px 0;">⏸ Pausa (${txt})</div>`;
        });

        const formatted = content.replace(/\[([^\]]+)\]/g, (match, chord) => {
            const clean = chord.replace(/\*+$/, '');
            if (app.isActualChord(clean)) {
                return `<span class="chord-bracket">[</span><b class="interactive-chord" style="color:#10b981;">${chord}</b><span class="chord-bracket">]</span>`;
            } else {
                return `<span class="chord-bracket">[</span><b style="color:#10b981; font-weight:700;">${chord}</b><span class="chord-bracket">]</span>`;
            }
        });

        preview.innerHTML = formatted;
    },

    setEditorTab: (tab) => {
        ['lyrics', 'tabs'].forEach(t => {
            document.getElementById(`editor-${t}-area`).classList.toggle('hidden', t !== tab);
            const btn = document.getElementById(`tab-${t}`);
            btn.classList.toggle('border-primary', t === tab);
            btn.classList.toggle('text-primary', t === tab);
            btn.classList.toggle('border-transparent', t !== tab);
            btn.classList.toggle('text-slate-400', t !== tab);
        });
    },

    saveCifra: async (e) => {
        e.preventDefault();
        const form = e.target;
        if (!app.db) { alert('Erro: Banco não conectado.'); return; }

        const btn = form.querySelector('button[type="submit"]');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round animate-spin">refresh</span> Salvando...';
        btn.disabled = true;

        const payload = {
            title: form.title.value,
            artist: form.artist.value,
            content: form.content.value,
            tabs: form.tabs.value || '',
            tom: form.tom.value || '',
            capo: form.capo.value || '',
            genre: form.genre.value || '',
            bpm: form.bpm.value || '',
            youtube: form.youtube.value || '',
            youtubeTraining: form.youtubeTraining.value || '',
            ready: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            const { collection, addDoc } = window.firestoreUtils;
            await addDoc(collection(app.db, 'cifras'), payload);
            app.showToast('Cifra salva com sucesso!');

            // Redirect to home after 1 second
            setTimeout(() => {
                location.href = 'home.html';
            }, 1000);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar: ' + error.message);
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    // Check local storage for theme
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
    }
    app.init();
});
