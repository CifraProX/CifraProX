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

    const isSchool = user.plan_id === 5 || user.role === 'admin' || user.role === 'school';

    const titleEl = document.getElementById('school-page-title');
    const roleLabel = document.getElementById('school-role-label');

    // Update Header Text
    if (titleEl) {
        titleEl.innerHTML = isSchool
            ? '<span class="material-icons-round text-blue-500">domain</span> Gestão de Salas'
            : '<span class="material-icons-round text-purple-500">school</span> Painel do Professor';
    }
    if (roleLabel) {
        roleLabel.innerText = isSchool ? 'Escola' : 'Professor';
    }

    // 1. Fetch Classrooms & Calculate Metrics
    await app.loadClassrooms();

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

        // Fetch classrooms logic
        let classrooms = [];
        try {
            const res = await fetch(`${app.API_URL}/classrooms`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) classrooms = await res.json();
            else throw new Error('API Error');
        } catch (e) {
            console.warn("[School] API unavailable, using Mock Data:", e);
            app.ensureMockClassrooms();
            classrooms = app.state.mockClassrooms || [];
            // Simulate network delay for effect
            await new Promise(r => setTimeout(r, 600));
        }

        // Store for Filtering
        app.state.classroomsResults = classrooms;

        // Render Dashboard
        app.renderSchoolDashboard(classrooms);

    } catch (e) {
        console.error("Critical error loading classrooms:", e);
        container.innerHTML = '<p class="text-center text-red-500 py-8">Erro crítico ao carregar dados.</p>';
    }
};

app.renderSchoolDashboard = (classrooms) => {
    // 1. Calculate Metrics
    const activeRooms = classrooms.filter(c => c.status === 'active').length;
    const totalStudents = classrooms.reduce((acc, c) => acc + (c.participantsCount || 0), 0);
    // Mock random attendance between 70% and 95%
    const avgAttendance = Math.floor(Math.random() * (98 - 75 + 1) + 75);

    // Update Metrics DOM
    const elActive = document.getElementById('metric-active-rooms');
    const elStudents = document.getElementById('metric-total-students');
    const elAttendance = document.getElementById('metric-attendance');
    const elNextClass = document.getElementById('metric-next-class-title');
    const elNextTime = document.getElementById('metric-next-class-time');

    if (elActive) elActive.textContent = activeRooms;
    if (elStudents) elStudents.textContent = totalStudents;
    if (elAttendance) elAttendance.textContent = avgAttendance + '%';

    // Mock Next Class
    if (elNextClass) {
        if (activeRooms > 0) {
            const randomClass = classrooms.find(c => c.status === 'active') || classrooms[0];
            elNextClass.textContent = randomClass.name;
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            elNextTime.textContent = `Amanhã, ${['14:00', '16:00', '19:00'][Math.floor(Math.random() * 3)]}`;
        } else {
            elNextClass.textContent = 'Nenhuma aula agendada';
            elNextTime.textContent = '--';
        }
    }

    // 2. Render Grid
    app.renderClassroomGrid(classrooms);
};

app.renderClassroomGrid = (classrooms) => {
    const container = document.getElementById('school-classrooms-list');
    if (!container) return;

    container.innerHTML = '';

    if (classrooms.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center p-12 text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <span class="material-icons-round text-4xl mb-2 opacity-50">meeting_room</span>
                <p>Nenhuma sala encontrada.</p>
            </div>
        `;
        return;
    }

    classrooms.forEach(c => {
        const isActive = c.status === 'active';
        const statusColor = isActive ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
        const statusLabel = isActive ? 'Ativa' : 'Arquivada';

        // Mock Level and Progress
        const level = ['Iniciante', 'Intermediário', 'Avançado'][Math.floor(Math.random() * 3)];
        const levelColor = level === 'Iniciante' ? 'text-blue-500' : (level === 'Intermediário' ? 'text-orange-500' : 'text-purple-500');
        const progress = Math.floor(Math.random() * 100);

        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all group flex flex-col h-full relative overflow-hidden';

        // Decorative top border
        const borderColor = isActive ? 'bg-emerald-500' : 'bg-slate-300';

        card.innerHTML = `
            <div class="h-1 w-full ${borderColor} absolute top-0 left-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div class="flex justify-between items-start mb-4">
                <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${statusColor}">
                    ${statusLabel}
                </span>
                <div class="relative">
                    <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <span class="material-icons-round">more_vert</span>
                    </button>
                </div>
            </div>

            <h3 class="font-bold text-xl text-slate-800 dark:text-white mb-1 group-hover:text-primary transition-colors line-clamp-1" title="${c.name}">
                ${c.name}
            </h3>
            
            <div class="flex items-center gap-2 mb-6">
                <div class="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                    <span class="material-icons-round text-sm opacity-50">tag</span> ${c.code}
                </div>
                 <div class="flex items-center gap-1.5 text-xs font-bold ${levelColor} bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                    <span class="material-icons-round text-sm opacity-50">signal_cellular_alt</span> ${level}
                </div>
            </div>

            <!-- Metrics Row -->
            <div class="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-50 dark:border-slate-700/50">
                <div>
                   <p class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Alunos</p>
                   <div class="flex items-center gap-2">
                        <span class="material-icons-round text-slate-400 text-sm">groups</span>
                        <span class="font-bold text-slate-700 dark:text-slate-200">${c.participantsCount || 0}</span>
                   </div>
                </div>
                <div>
                   <p class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Progresso</p>
                   <div class="flex items-center gap-2">
                        <div class="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div class="h-full bg-primary rounded-full" style="width: ${progress}%"></div>
                        </div>
                        <span class="text-xs font-bold text-primary">${progress}%</span>
                   </div>
                </div>
            </div>

                <div class="flex gap-2">
                    <button onclick="app.openClassroomManagement('${c.code}')" 
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
};

app.filterClassrooms = (query) => {
    if (!app.state.classroomsResults) return;
    const term = query.toLowerCase();
    const filtered = app.state.classroomsResults.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term)
    );
    app.renderClassroomGrid(filtered);
};    // Simulate network delay


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

    // Capture ID before hiding modal (which clears the state)
    const targetClassroom = app.state.pendingClassroomId;

    app.hideJoinClassroomModal();

    // Flag to bypass Navigate Guard
    app.state.justJoined = true;

    if (targetClassroom) {
        app.navigate('classroom', targetClassroom);
    } else {
        app.navigate('home');
    }
};

// --- CLASSROOM MANAGEMENT VIEW (New) ---

app.openClassroomManagement = (classroomId) => {
    console.log("Opening Management View for:", classroomId);
    app.state.currentManagementClassroom = classroomId;

    // 1. Toggle Views
    const dashboardModels = [
        document.getElementById('school-dashboard-metrics'), // Assuming separate container if exists, or just main
        document.getElementById('school-control-bar'),
        document.getElementById('school-classrooms-list')
    ];

    // Hide Dashboard
    // Note: Since metrics/controls are direct children of main in view-school, we need to handle them.
    // Ideally, wrap dashboard in a div. For now, logic:
    // We will look for a main dashboard container. If not found, we hide known elements.
    // Based on HTML structure, the metrics and control bar are direct children.
    // Let's create a helper to toggle.

    // Better Approach: Re-query elements or assume wrapper.
    // In index.html, I should arguably have wrapped the dashboard content. 
    // BUT since I didn't wrap them in a previous step, I will grab them by ID or class.

    // Let's assume (based on my previous view) that I need to hide specific dashboard elements.
    // Or I can add a specific class to the Dashboard elements?
    // Let's rely on finding them.

    const mgmtSection = document.getElementById('section-classroom-management');
    if (mgmtSection) mgmtSection.classList.remove('hidden');

    // Hide Dashboard specific IDs found in view-school template
    const metrics = document.querySelector('#view-school main > .grid'); // The 4 cards
    const controlBar = document.querySelector('#view-school main > .flex.justify-between');
    const list = document.getElementById('school-classrooms-list');

    if (metrics) metrics.classList.add('hidden');
    if (controlBar) controlBar.classList.add('hidden');
    if (list) list.classList.add('hidden');


    // 2. Set Title
    const classroom = app.state.mockClassrooms.find(c => c.code === classroomId) || { name: 'Sala Desconhecida', code: classroomId };
    const titleEl = document.getElementById('classroom-mgmt-title');
    const subEl = document.getElementById('classroom-mgmt-subtitle');

    if (titleEl) titleEl.textContent = classroom.name;
    if (subEl) subEl.textContent = `Código: ${classroom.code} • ${classroom.plan || 'Básico'}`;

    // 3. Render Tabs
    app.renderClassroomTabs('overview');
};

app.renderClassroomTabs = (activeTab = 'overview') => {
    const tabsContainer = document.getElementById('classroom-mgmt-tabs');
    const contentContainer = document.getElementById('classroom-mgmt-content');

    if (!tabsContainer || !contentContainer) return;

    const tabs = [
        { id: 'overview', label: 'Visão Geral', icon: 'dashboard' },
        { id: 'students', label: 'Alunos', icon: 'groups' },
        { id: 'content', label: 'Conteúdo', icon: 'library_music' },
        { id: 'settings', label: 'Configurações', icon: 'settings' }
    ];

    // Render Tab Headers
    tabsContainer.innerHTML = tabs.map(tab => {
        const isActive = tab.id === activeTab;
        const bg = isActive ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300';
        return `
            <button onclick="app.renderClassroomTabs('${tab.id}')" 
                class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${bg}">
                <span class="material-icons-round text-lg">${tab.icon}</span>
                ${tab.label}
            </button>
        `;
    }).join('');

    // Render Content
    app.renderClassroomTabContent(activeTab, contentContainer);
};

app.renderClassroomTabContent = (tabId, container) => {
    container.innerHTML = '<div class="flex justify-center p-8"><span class="animate-spin material-icons-round text-slate-400">sync</span></div>';

    const classroom = app.state.mockClassrooms.find(c => c.code === app.state.currentManagementClassroom);
    if (!classroom) return;

    setTimeout(() => {
        switch (tabId) {
            case 'overview':
                container.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <h4 class="text-slate-500 font-bold text-xs uppercase mb-2">Engajamento</h4>
                            <p class="text-3xl font-bold text-slate-800 dark:text-white">95%</p>
                            <span class="text-xs text-emerald-500 font-bold">+5% essa semana</span>
                        </div>
                        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <h4 class="text-slate-500 font-bold text-xs uppercase mb-2">Alunos Ativos</h4>
                            <p class="text-3xl font-bold text-slate-800 dark:text-white">${classroom.participantsCount || 0}</p>
                        </div>
                        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <h4 class="text-slate-500 font-bold text-xs uppercase mb-2">Conteúdos</h4>
                            <p class="text-3xl font-bold text-slate-800 dark:text-white">12</p>
                        </div>
                    </div>
                    
                    <div class="flex gap-4">
                        <button onclick="app.navigate('classroom', '${classroom.code}')" 
                            class="flex-1 bg-primary hover:bg-primary-dark text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95">
                            <span class="material-icons-round text-2xl">podcasts</span>
                            Iniciar Aula Ao Vivo
                        </button>
                         <button 
                            class="flex-1 bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all">
                            <span class="material-icons-round text-2xl">share</span>
                            Convidar Alunos
                        </button>
                    </div>
                `;
                break;
            case 'students':
                const students = [
                    { name: 'João Silva', status: 'online', instrument: 'Violão' },
                    { name: 'Maria Souza', status: 'offline', instrument: 'Vocal' },
                    { name: 'Pedro Santos', status: 'offline', instrument: 'Guitarra' },
                ]; // Mock

                container.innerHTML = `
                    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                            <thead class="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th class="px-6 py-4 font-bold">Aluno</th>
                                    <th class="px-6 py-4 font-bold">Instrumento</th>
                                    <th class="px-6 py-4 font-bold">Status</th>
                                    <th class="px-6 py-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                                ${students.map(s => `
                                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td class="px-6 py-4 font-bold text-slate-800 dark:text-white">${s.name}</td>
                                        <td class="px-6 py-4">${s.instrument}</td>
                                        <td class="px-6 py-4">
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">
                                                <span class="w-1.5 h-1.5 rounded-full ${s.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                                                ${s.status === 'online' ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 text-right">
                                            <button class="text-slate-400 hover:text-red-500 transition-colors"><span class="material-icons-round">delete</span></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                break;
            case 'content':
                container.innerHTML = `
                    <div class="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <span class="material-icons-round text-4xl text-slate-300 mb-4">library_music</span>
                        <p class="text-slate-500 font-medium">Nenhuma setlist criada.</p>
                        <button class="mt-4 text-primary font-bold hover:underline">Criar Setlist</button>
                    </div>
                `;
                break;
            case 'settings':
                container.innerHTML = `
                     <div class="max-w-2xl mx-auto space-y-6">
                        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-4">Dados da Sala</h3>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-bold text-slate-500 mb-1">Nome</label>
                                    <input type="text" value="${classroom.name}" class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white">
                                </div>
                            </div>
                            <div class="mt-6 flex justify-end">
                                <button class="bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-600 transition-colors">Salvar Alterações</button>
                            </div>
                        </div>

                        <div class="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
                            <h3 class="font-bold text-lg text-red-600 dark:text-red-400 mb-2">Zona de Perigo</h3>
                            <p class="text-sm text-red-500/80 mb-6">Ações irreversíveis.</p>
                            <button class="bg-white dark:bg-slate-800 text-red-500 border border-red-200 dark:border-red-900/50 px-6 py-2 rounded-xl font-bold hover:bg-red-50 transition-colors">
                                Excluir Sala Definitivamente
                            </button>
                        </div>
                     </div>
                `;
                break;
        }
    }, 300); // Simulate load
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
