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

    // --- CONFIGURAÇÃO LOCAL ---
    // --- CONFIGURAÇÃO LOCAL ---
    API_URL: window.location.origin, // Automático: usa o mesmo IP/Porta do acesso atual


    // Firebase Config (Restaurado)
    firebaseConfig: {
        apiKey: "AIzaSyDcx_MKD1ug5t_tEfyhYrmFkXBhLFssfyg",
        authDomain: "cifraprox-270126.firebaseapp.com",
        databaseURL: "https://cifraprox-270126-default-rtdb.firebaseio.com",
        projectId: "cifraprox-270126",
        storageBucket: "cifraprox-270126.firebasestorage.app",
        messagingSenderId: "901280078984",
        appId: "1:901280078984:web:6b1354ce044279c18e933d"
    },
    db: null,
    auth: null,

    init: async () => {
        try {
            console.log('Iniciando app (Hybrid Mode: SQL Auth + Firebase DB)...');

            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(app.firebaseConfig);
                console.log("Firebase conectado:", app.firebaseConfig.projectId);
            }

            app.db = firebase.database();
            app.auth = firebase.auth();

            // Initialize Theme
            const savedTheme = localStorage.getItem('theme') || 'light';
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-mode');
                app.updateThemeIcons();
            }

            // Check User Session (Stored in LocalStorage for simplicity in this migration)
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));

            if (token && user) {
                app.state.user = user;
                console.log('Usuário restaurado:', user.email);
            } else {
                app.state.user = null;
            }

            app.renderHeader(app.state.currentView);

            // Register Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register fail:', err));
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
                view = 'home';
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

    navigate: async (view, param = null, addToHistory = true) => {
        app.state.currentView = view;
        if (addToHistory) {
            history.pushState({ view, param }, '', `#${view}${param ? '/' + param : ''}`);
        }

        const main = document.getElementById('app');
        main.innerHTML = '';

        let templateId = `view-${view}`;
        const template = document.getElementById(templateId);

        if (!template) {
            main.innerHTML = '<div class="flex items-center justify-center h-screen text-red-500">Erro: View não encontrada</div>';
            return;
        }

        const clone = template.content.cloneNode(true);
        main.appendChild(clone);

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
        e.preventDefault();
        const form = e.target;
        const email = form.email.value;
        const password = form.password.value;

        try {
            const res = await fetch(`${app.API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Erro no login');

            // Salvar sessão
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            app.state.user = data.user;
            app.renderHeader('home');
            app.navigate('home');
        } catch (error) {
            console.error('Erro no login:', error);
            alert(error.message);
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
            const snapDup = await app.db.ref('cifras').orderByChild('title').equalTo(title).once('value');

            let isDuplicate = false;
            if (snapDup.exists()) {
                const val = snapDup.val();
                // Check artist manually
                Object.values(val).forEach(cifra => {
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
            if (tomEl && document.getElementById('edit-tom')) {
                // Pega apenas o que está em destaque (b ou a), ignorando o resto
                const specificTom = tomEl.querySelector('b') || tomEl.querySelector('a') || tomEl;
                let tomVal = specificTom.innerText.trim();
                document.getElementById('edit-tom').value = tomVal;
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
            tabs: form.tabs.value,
            tone: form.tom.value,
            capo: form.capo.value,
            genre: form.genre.value,
            bpm: form.bpm.value,
            youtube: form.youtube.value,
            youtubeTraining: form.youtubeTraining.value,
            ready: form.ready.checked
        };

        try {
            const url = id ? `${app.API_URL}/cifras/${id}` : `${app.API_URL}/cifras`;
            const method = id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': localStorage.getItem('token')
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Erro ao salvar.');

            alert('Cifra salva com sucesso!');
            app.navigate('home');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar cifra.');
        }
    },

    // Métodos removidos (Realtime e LoadCustom)
    initRealtimeListeners: () => { },
    stopRealtimeListeners: () => { },
    loadCustomChords: async () => { },


    // --- ADMIN MODULE ---
    loadAdminUsers: async () => {
        const list = document.getElementById('admin-users-list');
        if (!list) return;

        list.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center">Carregando...</td></tr>';

        try {
            const res = await fetch(`${app.API_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));

                if (res.status === 403 || res.status === 401) {
                    alert('Sua sessão expirou ou é inválida. Por favor, faça login novamente.');
                    app.logout();
                    return;
                }

                throw new Error(errData.message || `Erro ${res.status}: Falha ao carregar usuários`);
            }

            const users = await res.json();

            // Calc stats
            document.getElementById('stat-total-users').innerText = users.length;
            document.getElementById('stat-active-users').innerText = users.filter(u => u.status === 'active').length;
            document.getElementById('stat-suspended-users').innerText = users.filter(u => u.status !== 'active').length;

            list.innerHTML = users.map(u => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td class="px-6 py-4">
                        <p class="font-bold text-slate-800 dark:text-white">${u.name || 'Sem nome'}</p>
                        <p class="text-xs text-slate-400">${u.email}</p>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                <span class="material-icons-round text-[10px]">music_note</span> ${u.instrument || '-'}
                            </span>
                            <span class="text-xs text-slate-400 flex items-center gap-1">
                                <span class="material-icons-round text-[10px]">smartphone</span> ${u.phone || '-'}
                            </span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : (u.role === 'professor' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}">
                            ${u.role}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div class="flex flex-col">
                            <span class="font-bold text-xs">${u.plan_name || 'Free'}</span>
                            <span class="text-[10px] text-slate-400 hidden sm:inline-block">CPF: ${u.cpf || '-'}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                            <span class="h-1.5 w-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                            ${u.status === 'active' ? 'Ativo' : 'Suspenso'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="app.editUser('${u.id}')" class="text-slate-400 hover:text-primary transition-colors font-bold text-xs uppercase mr-2">Gerenciar</button>
                        <button onclick="app.deleteUser('${u.id}')" class="text-red-300 hover:text-red-600 transition-colors font-bold text-xs uppercase" title="Excluir Usuário">
                            <span class="material-icons-round text-sm align-middle">delete</span>
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (e) {
            console.error(e);
            list.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">${e.message}</td></tr>`;
        }
    },

    modalAddUser: async () => {
        // Fetch plans first
        let plans = [];
        try {
            const res = await fetch(`${app.API_URL}/admin/plans`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            plans = await res.json();
        } catch (e) {
            console.error('Erro ao buscar planos', e);
            plans = [{ id: null, name: 'Erro ao carregar planos' }];
        }

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
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-bold mb-1">Plano</label>
                        <select id="new-user-plan" class="w-full rounded border-slate-300 p-2">
                            <option value="">Sem Plano</option>
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
                const plan_id = document.getElementById('new-user-plan').value || null;

                if (!email || !password) return alert('E-mail e senha são obrigatórios.');

                try {
                    const res = await fetch(`${app.API_URL}/admin/users`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify({ email, password, role, plan_id, status: 'active' })
                    });
                    if (!res.ok) throw new Error('Erro ao criar');
                    app.showToast('Usuário criado!');
                    app.loadAdminUsers();
                } catch (e) {
                    alert('Falha ao criar usuário. Verifique se o e-mail já existe.');
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
                <option value="${p.id}" ${user.plan_name === p.name ? 'selected' : ''}>${p.name} (Max: ${p.max_connections})</option>
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
                onConfirm: async () => {
                    const status = document.getElementById('edit-user-status').value;
                    const role = document.getElementById('edit-user-role').value;
                    const plan_id = document.getElementById('edit-user-plan').value || null;

                    try {
                        const res = await fetch(`${app.API_URL}/admin/users/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                            body: JSON.stringify({ status, role, plan_id })
                        });

                        // Parse erro da resposta PUT se houver
                        if (!res.ok) {
                            const errRes = await res.json().catch(() => ({}));
                            throw new Error(errRes.message || 'Falha na atualização');
                        }

                        app.showToast('Usuário atualizado!');
                        app.loadAdminUsers();
                    } catch (e) {
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
            const res = await fetch(`${app.API_URL}/admin/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Erro ao excluir usuário');
            }

            app.showToast('Usuário excluído com sucesso.');
            app.loadAdminUsers();
        } catch (e) {
            alert(e.message);
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

        list.innerHTML = '<p style="color:var(--text-muted)">Sincronizando com Firebase...</p>';

        try {
            // Listener em Tempo Real (Firestore)
            // Se o usuário pedir ordenação diferente depois, podemos ajustar. 
            // Por padrão, 'updatedAt' desc (mais recentes primeiro).
            const cifrasRef = app.db.ref('cifras');
            const onValue = (snapshot) => {
                const val = snapshot.val();
                app.state.cifras = val ? Object.keys(val).map(key => ({ id: key, ...val[key] })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
                app.filterCifras();
            };
            cifrasRef.on('value', onValue, (error) => {
                list.innerHTML = `<p style="color:red">Erro: ${error.message}</p>`;
            });
            app.state.unsubs.cifras = onValue;

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
        toast.style.cssText = 'position:fixed; bottom: 100px; right: 2rem; background: var(--bg-header); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; z-index: 2100; box-shadow: 0 4px 6px rgba(0,0,0,0.1); opacity: 0; transition: opacity 0.3s; pointer-events:none;';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = '1');
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // --- MODAL SYSTEM (Premium Dialogs) ---
    modal: ({ title, content, input = false, confirmText = 'OK', cancelText = 'Cancelar', placeholder = '', onConfirm = null }) => {
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

    loadCifra: async (id) => {
        try {
            const snap = await app.db.ref('cifras/' + id).once('value');

            if (!snap.exists()) {
                alert('Cifra não encontrada.');
                app.navigate('home');
                return;
            }

            const data = { id: snap.key, ...snap.val() };

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
        // RTDB uses this constant
        data.updatedAt = firebase.database.ServerValue.TIMESTAMP;

        try {
            if (id) {
                // UPDATE
                // Check duplicate: RTDB doesn't query multiple fields nicely client-side.
                // We'll skip complex dup check or do it by fetching all and filtering in memory (less efficient)
                // OR just trust the user since we are migrating. Let's do simple title check.
                const snap = await app.db.ref('cifras').orderByChild('title').equalTo(data.title.trim()).once('value');

                // Client-side filtering for artist
                let isDuplicate = false;
                snap.forEach(child => {
                    if (child.key !== id && child.val().artist === data.artist.trim()) {
                        isDuplicate = true;
                    }
                });

                if (isDuplicate) {
                    const confirmDup = confirm(`Atenção: Já existe outra música "${data.title}" de "${data.artist}". Salvar mesmo assim?`);
                    if (!confirmDup) return;
                }

                await app.db.ref('cifras/' + id).update(data);
                app.navigate('cifra', id);
            } else {
                // CREATE
                const snap = await app.db.ref('cifras').orderByChild('title').equalTo(data.title.trim()).once('value');
                let isDuplicate = false;
                snap.forEach(child => {
                    if (child.val().artist === data.artist.trim()) {
                        isDuplicate = true;
                    }
                });

                if (isDuplicate) {
                    const confirmDup = confirm(`Atenção: Já existe "${data.title}" de "${data.artist}". Criar duplicata?`);
                    if (!confirmDup) return;
                }

                // Push creates a new ref with ID
                const newRef = app.db.ref('cifras').push();
                await newRef.set(data);
                app.navigate('cifra', newRef.key);
            }
        } catch (e) {
            console.error('Erro em saveCifra:', e);
            if (e.code === 'permission-denied') {
                app.modal({ title: 'Permissão Negada', content: 'Você não tem permissão para salvar alterações (apenas Admin?).', confirmText: 'OK', cancelText: null });
            } else {
                app.modal({ title: 'Erro', content: `Erro ao salvar: ${e.message}`, confirmText: 'OK', cancelText: null });
            }
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
            await app.db.ref('cifras/' + id).remove();
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

        const ref = app.db.ref('setlists');
        const listener = ref.on('value', (snap) => {
            const val = snap.val();
            if (!val) {
                app.state.setlists = [];
            } else {
                app.state.setlists = Object.keys(val).map(key => ({
                    id: key,
                    ...val[key]
                })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            }
            app.renderSetlistsGrid();
        });

        app.state.unsubs.setlists = listener;
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
            const newRef = app.db.ref('setlists').push();
            await newRef.set({
                name: name,
                songs: [],
                updatedAt: firebase.database.ServerValue.TIMESTAMP
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
            await app.db.ref('setlists/' + id).remove();
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
            const ref = app.db.ref('setlists/' + setlistId);
            const snap = await ref.once('value');
            if (!snap.exists()) return;

            const data = snap.val();
            const songs = data.songs || [];

            if (!songs.includes(songId)) {
                songs.push(songId);
                await ref.update({
                    songs: songs,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
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
        const cpf = form.cpf.value;
        const phone = form.phone.value;
        const email = form.email.value;
        // Password might be named 'password' or 'reg-password'. Checking form.
        // Assuming name="password" as per previous lines.
        const password = form.password ? form.password.value : document.getElementById('reg-password')?.value;
        const type = form.type.value;
        const instrument = form.instrument ? form.instrument.value : 'Violão'; // Default or from form

        console.log('DEBUG FRONTEND: Payload Type selected ->', type);
        console.log('DEBUG FRONTEND: Full Payload ->', { name, cpf, phone, instrument, email, password, type });

        try {
            const res = await fetch(`${app.API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, cpf, phone, instrument, email, password, type })
            });

            if (!res.ok) {
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.indexOf('application/json') !== -1) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Erro no cadastro (Server)');
                } else {
                    const text = await res.text();
                    console.error('Non-JSON Error Response:', text);
                    // Extract title from HTML if possible for cleaner alert
                    const match = text.match(/<title>(.*?)<\/title>/i) || text.match(/<body>(.*?)<\/body>/i);
                    const msg = match ? match[1] : text.substring(0, 100);
                    throw new Error(`Erro do Servidor (${res.status}): ${msg}`);
                }
            }

            const data = await res.json();

            // Cadastro sucesso: Fazer Login automático
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            app.state.user = data.user;

            // ... (rest of success logic) ...

            // Payment Redirect Handler (Moved from old logic if needed, or ensuring consistent flow)
            if (data.redirectUrl) {
                app.modal({
                    title: 'Pagamento Necessário 💳',
                    content: `Sua conta foi criada! Para ativar a licença do plano <b>${type.toUpperCase()}</b>, finalize o pagamento.`,
                    confirmText: 'Pagar Agora',
                    cancelText: 'Pagar depois',
                    onConfirm: () => {
                        window.location.href = data.redirectUrl;
                    }
                });
                return;
            }

            app.showToast('Conta criada com sucesso! 🚀');
            app.navigate('home');

        } catch (e) {
            console.error('Registro falhou:', e);
            alert('Falha: ' + e.message);
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
                    const snap = await app.db.ref('cifras/' + songId).once('value');
                    if (snap.exists()) c = { id: snap.key, ...snap.val() };
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
            await app.db.ref('setlists/' + setlist.id).update({
                songs: songs,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
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
            await app.db.ref('setlists/' + setlist.id).update({
                songs: songs,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
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

document.addEventListener('DOMContentLoaded', app.init);
