// --- CLASSROOM MODULE ---
app.classroomConfig = {};

// Helper to ensure Mock Data exists (for direct URL access)
app.ensureMockClassrooms = () => {
    // Always load from storage or defaults
    let mocks = [];
    const savedMock = localStorage.getItem('cifraprox_mock_classrooms');

    if (savedMock) {
        mocks = JSON.parse(savedMock);
    } else {
        mocks = [
            { name: 'Sala de Teste (Mock)', code: 'MOCK01', participantsCount: 12, status: 'active' },
            { name: 'Turma de Violão - Iniciante', code: 'VIOLAO', participantsCount: 5, status: 'active' },
            { name: 'Aula Antiga', code: 'OLD001', participantsCount: 20, status: 'closed' }
        ];
    }

    // FIX: FORCE OVERWRITE OWNERSHIP for default mocks to ensure security patch applies to existing users
    mocks.forEach(m => {
        if (['MOCK01', 'VIOLAO', 'OLD001'].includes(m.code)) {
            m.ownerId = 'mock_user'; // Enforce strict non-ownership for logged in users
        }
    });

    app.state.mockClassrooms = mocks;
    localStorage.setItem('cifraprox_mock_classrooms', JSON.stringify(mocks));
};

// --- SCHOOL BOARD (Minhas Salas) ---
app.loadSchoolDashboard = async () => {
    const user = app.state.user;
    if (!user) return;

    // Fix: Defaults to false if no plan_id
    const isSchool = user.plan_id === 5; // 5 = Escola Básico
    // Or user.role === 'school'? Let's stick to plan_id for now as per original code

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
        // IMPORTANT: In the new HTML, this ID only wraps the PROFESSORS list, not the whole page.
        // So we can safely toggle it.
        if (isSchool) {
            manageProfSection.classList.remove('hidden');
        } else {
            manageProfSection.classList.add('hidden');
        }
    }

    // 1. Load Professors (Only if School)
    if (isSchool) {
        const list = document.getElementById('school-professors-list');
        const empty = document.getElementById('school-empty-state');
        if (list) {
            list.innerHTML = '<tr><td colspan="5" class="text-center p-4">Carregando professores...</td></tr>';
            // Mock or Fetch Logic here
            setTimeout(() => {
                list.innerHTML = ''; // Clear loading
                if (empty) empty.classList.remove('hidden');
            }, 500);
        }
    }

    // 2. Load Classrooms
    app.loadClassrooms();

    // 3. Load Repertoire (Professor View only)
    // If isSchool, maybe we don't show repertoire? Adjusted logic:
    // Teachers need repertoire to send to students.
    if (app.loadCifras) {
        app.loadCifras('school-cifras-list');
    }
};

app.loadClassrooms = async () => {
    const container = document.getElementById('school-classrooms-list');
    if (!container) return;

    try {
        let uid = app.state.user ? app.state.user.uid : null;
        if (!uid && app.auth && app.auth.currentUser) {
            uid = app.auth.currentUser.uid;
            if (app.state.user) app.state.user.uid = uid;
        }

        if (!uid) {
            container.innerHTML = '<p class="text-center text-red-500 py-8">Erro: Usuário não identificado.</p>';
            return;
        }

        container.innerHTML = '<p class="text-center text-slate-400 py-8 col-span-full">Atualizando salas...</p>';

        // Fetch classrooms logic
        const res = await fetch(`${app.API_URL}/classrooms`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) throw new Error('Falha ao buscar salas');
        const classrooms = await res.json();

        container.innerHTML = '';

        if (classrooms.length === 0) {
            container.innerHTML = `
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
                </div>

                <div class="flex gap-2">
                    <button onclick="app.navigate('classroom', '${c.code}')" 
                        class="flex-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-white py-2 rounded-xl font-bold transition-colors">
                        Gerenciar
                    </button>
                    
                    <button onclick="app.copyClassroomLink('${c.code}')" 
                        class="flex-1 border border-purple-100 dark:border-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                        <span class="material-icons-round text-sm">link</span>
                    </button>

                    ${c.status === 'active' ? `
                    <button onclick="app.closeClassroom('${c.code}')" title="Encerrar Sala"
                        class="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors">
                        <span class="material-icons-round">block</span>
                    </button>
                    ` : ''}
                </div>
             `;
            container.appendChild(card);
        });

    } catch (e) {
        console.warn("[School] API unavailable, using Mock Data:", e);

        // --- MOCK FALLBACK ---

        // Ensure Mock Data
        app.ensureMockClassrooms();

        const mockClassrooms = app.state.mockClassrooms;

        // Simulate network delay
        await new Promise(r => setTimeout(r, 500));

        container.innerHTML = '';
        if (mockClassrooms.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center p-12 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <span class="material-icons-round text-4xl mb-2 opacity-50">meeting_room</span>
                    <p>Nenhuma sala criada ainda.</p>
                </div>
            `;
            return;
        }

        mockClassrooms.forEach(c => {
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
                </div>

                <div class="flex gap-2">
                    <button onclick="app.navigate('classroom', '${c.code}')" 
                        class="flex-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-white py-2 rounded-xl font-bold transition-colors">
                        Gerenciar
                    </button>
                    
                    <button onclick="app.copyClassroomLink('${c.code}')" 
                        class="flex-1 border border-purple-100 dark:border-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                        <span class="material-icons-round text-sm">link</span>
                    </button>

                    ${c.status === 'active' ? `
                    <button onclick="app.closeClassroom('${c.code}')" title="Encerrar Sala"
                        class="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors">
                        <span class="material-icons-round">block</span>
                    </button>
                    ` : `
                    <button onclick="app.deleteClassroom('${c.code}')" title="Excluir Sala"
                        class="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-xl transition-colors">
                        <span class="material-icons-round">delete</span>
                    </button>
                    `}
                </div>
             `;
            container.appendChild(card);
        });

        app.showToast('Modo Offline: Dados simulados carregados.', 'warning');
    }
};

// --- MODAL & CREATE LOGIC ---

app.showCreateClassroomModal = () => {
    const modal = document.getElementById('create-classroom-modal');
    if (modal) {
        modal.classList.remove('pointer-events-none', 'opacity-0');
        modal.classList.add('pointer-events-auto', 'opacity-100');
        const input = document.getElementById('new-classroom-name');
        if (input) input.focus();
    }
};

app.hideCreateClassroomModal = () => {
    const modal = document.getElementById('create-classroom-modal');
    if (modal) {
        modal.classList.add('pointer-events-none', 'opacity-0');
        modal.classList.remove('pointer-events-auto', 'opacity-100');
    }
};

app.createClassroom = async () => {
    const nameInput = document.getElementById('new-classroom-name');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) return app.showToast('Digite um nome para a sala');

    const btn = document.querySelector('#create-classroom-btn');
    if (btn) { btn.disabled = true; btn.innerText = 'Criando...'; }

    try {
        let uid = app.state.user ? app.state.user.uid : app.auth.currentUser.uid;

        console.log(`[Create] Calling API: ${app.API_URL}/classrooms`);
        const res = await fetch(`${app.API_URL}/classrooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name, createdBy: uid })
        });

        if (!res.ok) throw new Error('Falha ao criar sala');

        // const data = await res.json();
        app.showToast('Sala criada com sucesso!');
        nameInput.value = '';
        app.hideCreateClassroomModal();
        app.loadSchoolDashboard();

    } catch (e) {
        console.warn("[Create] API Failed, Mocking Success:", e);

        // Update Mock State
        if (app.state.mockClassrooms) {
            app.state.mockClassrooms.push({
                name: name,
                code: 'MOCK' + Math.floor(Math.random() * 1000),
                participantsCount: 0,
                status: 'active',
                ownerId: app.state.user ? app.state.user.uid : 'mock_user'
            });
            localStorage.setItem('cifraprox_mock_classrooms', JSON.stringify(app.state.mockClassrooms));
        }

        app.showToast('Sala criada (Simulação Offline)!');
        nameInput.value = '';
        app.hideCreateClassroomModal();
        app.loadSchoolDashboard(); // Will trigger mock load
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'Criar Sala'; }
    }
};

app.closeClassroom = async (code) => {
    if (!confirm('Tem certeza que deseja encerrar esta sala? Os alunos serão desconectados.')) return;

    try {
        console.log(`[Close] Calling API: ${app.API_URL}/classrooms/${code}/close`);
        const res = await fetch(`${app.API_URL}/classrooms/${code}/close`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) throw new Error('Falha ao encerrar');

        app.showToast('Sala encerrada com sucesso.');
        app.loadSchoolDashboard();
    } catch (e) {
        console.warn("[Close] API Failed, Mocking Success:", e);

        // Update Mock State
        if (app.state.mockClassrooms) {
            const room = app.state.mockClassrooms.find(r => r.code === code);
            if (room) {
                room.status = 'closed';
                localStorage.setItem('cifraprox_mock_classrooms', JSON.stringify(app.state.mockClassrooms));
            }
        }

        // Temporary optimistic update for demo
        app.showToast('Sala encerrada (Simulação Offline).');
        app.loadSchoolDashboard();
    }
};

app.deleteClassroom = async (code) => {
    if (!confirm('Tem certeza que deseja excluir esta sala do histórico?')) return;

    try {
        // Mock Implementation Only for now (as requested context suggests focus on Mock/Offline)
        // If real API existed: await fetch(..., { method: 'DELETE' })

        // Update Mock State
        if (app.state.mockClassrooms) {
            app.state.mockClassrooms = app.state.mockClassrooms.filter(r => r.code !== code);
            localStorage.setItem('cifraprox_mock_classrooms', JSON.stringify(app.state.mockClassrooms));
        }

        app.showToast('Sala removida do histórico.');
        app.loadSchoolDashboard();

    } catch (e) {
        console.error("Delete failed", e);
        app.showToast('Erro ao excluir sala.', 'error');
    }
};

app.joinClassroom = async (codeOverride = null, mode = 'guest') => {
    const codeInput = document.getElementById('classroom-code-input');
    const code = codeOverride || (codeInput ? codeInput.value.trim().toUpperCase() : null);

    if (!code) return alert('Digite o código');

    const btn = document.querySelector('#classroom-join-area button');
    if (btn) {
        btn.innerText = 'Verificando...';
        btn.disabled = true;
    }

    try {
        let guestName = null;
        if (!app.state.user) {
            const nameInput = document.getElementById('guest-name-input');
            guestName = nameInput ? nameInput.value : (localStorage.getItem('guestName') || 'Visitante');
        }

        console.log(`[Join] Calling API: ${app.API_URL}/classrooms/${code}/join`);
        const res = await fetch(`${app.API_URL}/classrooms/${code}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guestName })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Erro ao entrar na sala');

        console.log("Entrou na sala:", data);

        if (app.state.currentView !== 'classroom') {
            app.navigate('classroom', code);
        } else {
            if (app.loadClassroom) app.loadClassroom(code);
        }

    } catch (e) {
        console.warn("[Join] API Failed, Mocking Success:", e);

        // Mock Success for Join
        const mockData = {
            success: true,
            roomName: 'Sala Simulada (Offline)',
            ownerId: 'mock_owner',
            participantId: 'mock_participant_' + Date.now()
        };

        console.log("Entrou na sala (Mock):", mockData);
        app.showToast('Entrou na sala (Simulação Offline)');

        if (app.state.currentView !== 'classroom') {
            app.navigate('classroom', code);
        } else {
            if (app.loadClassroom) app.loadClassroom(code);
        }
    } finally {
        if (btn) {
            btn.innerText = 'Entrar na Aula';
            btn.disabled = false;
        }
    }
};

// New Join Guard Logic
app.showJoinClassroomModal = (classroomId) => {
    app.state.pendingClassroomId = classroomId;
    const modal = document.getElementById('join-classroom-modal');
    if (modal) {
        modal.classList.add('active');
        modal.classList.remove('pointer-events-none', 'opacity-0');
        modal.style.pointerEvents = 'all';
        modal.style.opacity = '1';
    }
};

app.hideJoinClassroomModal = () => {
    const modal = document.getElementById('join-classroom-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('pointer-events-none', 'opacity-0');
        modal.style.pointerEvents = 'none';
        modal.style.opacity = '0';
    }
    app.state.pendingClassroomId = null;
};

app.joinAsGuest = async () => {
    const nameInput = document.getElementById('guest-name-input');
    const guestName = nameInput ? nameInput.value.trim() : '';

    if (!guestName) {
        app.showToast('Por favor, digite seu nome.');
        if (nameInput) nameInput.focus();
        return;
    }

    // Use Auth Module
    await app.loginAsGuest(guestName);

    app.hideJoinClassroomModal();

    // Flag to bypass Navigate Guard
    app.state.justJoined = true;

    if (app.state.pendingClassroomId) {
        app.navigate('classroom', app.state.pendingClassroomId);
    } else {
        app.navigate('home');
    }
};

app.copyClassroomLink = (id) => {
    const link = window.location.href.split('#')[0] + '#classroom/' + id;
    navigator.clipboard.writeText(link).then(() => {
        app.showToast('Link copiado! 📋');
    });
};

app.loadClassroom = async (classroomId) => {
    console.log("Loading Classroom View:", classroomId);
    app.state.currentClassroomCode = classroomId;

    // 1. Get Classroom Data (Mock or API)
    let classroom = null;

    // Check Mock First
    app.ensureMockClassrooms(); // Ensure data exists
    if (app.state.mockClassrooms) {
        classroom = app.state.mockClassrooms.find(c => c.code === classroomId);
    }

    // --- FIX: LOADING STATE GUARD ---
    // If user is null but we have a token, we are likely restoring session.
    // Don't show "Student/Guest" view yet. Show Loading.
    const hasToken = localStorage.getItem('token');
    if (!app.state.user && hasToken) {
        console.log('[Classroom] Waiting for session restore...');
        const container = document.getElementById('classroom-active-area');
        if (container) {
            container.innerHTML = `
                <div class="flex items-center justify-center h-screen bg-slate-900 text-white flex-col gap-4">
                    <span class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                    <p class="animate-pulse">Verificando permissões...</p>
                </div>
             `;
            container.classList.remove('hidden');
        }
        return; // STOP EXECUTION HERE. Auth Listener will re-call this when ready.
    }
    // -------------------------------

    // Determine Role
    const currentUser = app.state.user || { uid: 'guest', role: 'guest' };

    // Fix for F5/Reload: If classroom is owned by 'mock_user' and we are logged in, assume ownership (for demo)
    // FIX: Strict check. Only the actual owner sees Teacher View.
    // Guests AND unconnected Teachers see Student View for MOCK rooms.
    const isOwner = classroom && (
        classroom.ownerId === currentUser.uid
        // REMOVED: || (classroom.ownerId === 'mock_user' && currentUser.role !== 'guest')
    );

    // UI References
    const titleEl = document.getElementById('classroom-title');
    const codeEl = document.getElementById('sidebar-classroom-code');
    const teacherArea = document.getElementById('classroom-teacher-area');
    const studentArea = document.getElementById('classroom-student-area');

    // Set Header Info
    if (titleEl) titleEl.textContent = classroom ? classroom.name : `Sala ${classroomId}`;
    if (codeEl) codeEl.textContent = classroomId;

    // 2. Render Role View
    if (isOwner) {
        // TEACHER VIEW
        if (teacherArea) teacherArea.classList.remove('hidden');
        if (studentArea) studentArea.classList.add('hidden');
        app.renderClassroomRepertoire(); // Load Music List (Editable)
    } else {
        // STUDENT / GUEST VIEW
        if (teacherArea) teacherArea.classList.add('hidden');
        if (studentArea) studentArea.classList.remove('hidden');

        // Render Repertoire (Read-Only)
        app.renderClassroomRepertoire();

        // Guest Banner Logic
        const banner = document.getElementById('guest-signup-banner');
        if (currentUser.isGuest) {
            if (!banner) {
                // Inject Banner if missing
                const bannerHTML = `
                <div id="guest-signup-banner" class="bg-indigo-600 text-white p-4 rounded-xl shadow-lg mb-6 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                         <div class="bg-white/20 p-2 rounded-lg">
                            <span class="material-icons-round">person_outline</span>
                        </div>
                        <div>
                            <h4 class="font-bold text-sm">Você é um Visitante</h4>
                            <p class="text-xs text-indigo-100">Crie uma conta para salvar suas músicas e playlists.</p>
                        </div>
                    </div>
                    <button onclick="app.navigate('register')" class="bg-white text-indigo-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors">
                        Criar Conta
                    </button>
                </div>`;
                studentArea.insertAdjacentHTML('afterbegin', bannerHTML);
            }
        } else {
            // Remove banner if present (e.g. after login)
            if (banner) banner.remove();
        }
    }

    // 3. Render Participants (Mock)
    app.renderClassroomParticipants();
};

app.renderClassroomRepertoire = () => {
    const list = document.getElementById('classroom-music-list');
    if (!list) return;

    // Mock Repertoire
    const songs = [
        { id: 1, title: 'Hotel California', artist: 'Eagles' },
        { id: 2, title: 'Tempo Perdido', artist: 'Legião Urbana' },
        { id: 3, title: 'Sozinho', artist: 'Caetano Veloso' },
        { id: 4, title: 'Ai Se Eu Te Pego', artist: 'Michel Teló' },
        { id: 5, title: 'Pais e Filhos', artist: 'Legião Urbana' }
    ];

    list.innerHTML = songs.map(song => `
        <div class="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg group cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-sm">
                    ${song.title.charAt(0)}
                </div>
                <div>
                    <h4 class="font-bold text-sm text-slate-800 dark:text-white group-hover:text-primary transition-colors">${song.title}</h4>
                    <p class="text-xs text-slate-500">${song.artist}</p>
                </div>
            </div>
            <button class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-primary hover:text-white text-slate-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                <span class="material-icons-round text-sm">play_arrow</span>
            </button>
        </div>
    `).join('');
};

app.renderClassroomParticipants = () => {
    const list = document.getElementById('classroom-students-list');
    const countLabel = document.getElementById('label-participants-count');
    if (!list) return;

    // Mock Participants
    const students = [
        { name: 'João Silva', status: 'online' },
        { name: 'Maria Souza', status: 'online' },
        { name: 'Pedro Santos', status: 'idle' }
    ];

    if (countLabel) countLabel.innerText = students.length;

    list.innerHTML = students.map(s => `
        <li class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    ${s.name.charAt(0)}
                </div>
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">${s.name}</span>
            </div>
            <span class="w-2 h-2 rounded-full ${s.status === 'online' ? 'bg-green-500' : 'bg-amber-500'}"></span>
        </li>
    `).join('');
};
