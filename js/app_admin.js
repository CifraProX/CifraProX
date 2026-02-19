// --- ADMIN MODULE ---
app.adminConfig = {};

app.loadAdminUsers = async () => {
    // Check Guard
    if (!app.state.user || app.state.user.role !== 'admin') {
        app.navigate('home');
        return;
    }

    const list = document.getElementById('admin-users-list');
    if (list) list.innerHTML = '<p class="text-center p-4">Carregando usuários...</p>';

    try {
        let users = [];

        // STRATEGY 1: Named DB (Modular)
        if (app.namedDb && window.firestoreUtils) {
            console.log('[ADMIN] Buscando usuários no Banco Nomeado...');
            const { collection, getDocs } = window.firestoreUtils;
            const querySnapshot = await getDocs(collection(app.namedDb, "users"));
            querySnapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() });
            });
        }

        // STRATEGY 2: Fallback (Compat)
        if (users.length === 0) {
            console.log('[ADMIN] Buscando usuários no Banco Default...');
            const snapshot = await app.db.collection('users').get();
            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
        }

        if (users.length === 0) {
            list.innerHTML = '<p class="text-center p-4">Nenhum usuário encontrado.</p>';
            // Update Stats to 0
            if (document.getElementById('stat-total-users')) document.getElementById('stat-total-users').innerText = '0';
            if (document.getElementById('stat-active-users')) document.getElementById('stat-active-users').innerText = '0';
            if (document.getElementById('stat-suspended-users')) document.getElementById('stat-suspended-users').innerText = '0';
            return;
        }

        // --- STATS LOGIC ---
        const totalUsers = users.length;
        const activeUsers = users.filter(u => !u.status || u.status === 'active').length; // Default to active if missing
        const suspendedUsers = users.filter(u => u.status === 'suspended' || u.status === 'overdue').length;

        if (document.getElementById('stat-total-users')) document.getElementById('stat-total-users').innerText = totalUsers;
        if (document.getElementById('stat-active-users')) document.getElementById('stat-active-users').innerText = activeUsers;
        if (document.getElementById('stat-suspended-users')) document.getElementById('stat-suspended-users').innerText = suspendedUsers;


        // --- TABLE GENERATION ---

        // CACHE FOR INSTANT EDIT
        app.state.adminUsersCache = users;

        let html = '';
        users.forEach(u => {
            const roleBadge = u.role === 'admin' ? '<span class="badge badge-error font-bold">Admin</span>'
                : u.role === 'teacher' || u.role === 'school' ? '<span class="badge badge-info font-bold">Professor</span>'
                    : '<span class="badge badge-ghost font-bold">Aluno</span>';

            const statusBadge = (u.status === 'suspended' || u.status === 'overdue')
                ? '<span class="badge badge-warning text-xs">Inadimplente</span>'
                : '<span class="badge badge-success text-xs">Ativo</span>';

            const planName = u.plan_id || u.type || 'Free';
            const instrument = u.instrument || '-';

            html += `
            <tr class="hover group border-b border-slate-100 dark:border-slate-700/50 last:border-none transition-colors">
                <td class="align-middle py-4 px-6">
                    <div class="flex items-center gap-4">
                        <div class="avatar placeholder">
                            <div class="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl w-12 h-12 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-800">
                                <span class="text-lg font-bold tracking-tight">${(u.name || "?").substring(0, 2).toUpperCase()}</span>
                            </div>
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 dark:text-slate-100 text-base subpixel-antialiased">${u.name || 'Sem Nome'}</div>
                            <div class="text-xs text-slate-500 font-medium tracking-wide">${u.email || ''}</div>
                        </div>
                    </div>
                </td>

                <!-- Detalhes (Instrumento) -->
                <td class="align-middle px-6">
                    ${instrument !== '-'
                    ? `<div class="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                             <span class="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">${instrument}</span>
                           </div>`
                    : '<span class="text-slate-300 text-xl font-bold px-2">·</span>'
                }
                </td>

                <!-- Role -->
                <td class="align-middle px-6">${roleBadge}</td>

                <!-- Plano -->
                <td class="align-middle px-6">
                    <span class="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">${planName}</span>
                </td>

                <!-- Status -->
                <td class="align-middle px-6">${statusBadge}</td>

                <!-- Ações -->
                <th class="text-right align-middle px-6">
                    <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border border-transparent hover:border-indigo-100" onclick="app.editUser('${u.id}')" title="Editar">
                            <span class="material-icons-round text-lg">edit</span>
                        </button>
                        <button class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all border border-transparent hover:border-rose-100" onclick="app.deleteUser('${u.id}')" title="Excluir">
                            <span class="material-icons-round text-lg">delete</span>
                        </button>
                    </div>
                </th>
            </tr>`;
        });

        if (list) list.innerHTML = html;

    } catch (e) {
        console.error(e);
        if (list) list.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar usuários.</p>';
    }
};

// Helper for Tabs
app.switchAdminTab = (tabId) => {
    // 1. Update Buttons
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('bg-primary', 'text-white', 'shadow-md');
            btn.classList.remove('text-slate-500', 'hover:bg-slate-100', 'dark:text-slate-400', 'dark:hover:bg-slate-800');
        } else {
            btn.classList.remove('bg-primary', 'text-white', 'shadow-md');
            btn.classList.add('text-slate-500', 'hover:bg-slate-100', 'dark:text-slate-400', 'dark:hover:bg-slate-800');
        }
    });

    // 2. toggle Content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        if (content.id === `tab-${tabId}`) {
            content.classList.remove('hidden');
            // Add subtle animation
            content.classList.add('animate-fadeIn');
        } else {
            content.classList.add('hidden');
            content.classList.remove('animate-fadeIn');
        }
    });
};

app.editUser = async (uid) => {
    let u = null;

    // 1. TRY CACHE FIRST (Instant Load)
    if (app.state.adminUsersCache) {
        u = app.state.adminUsersCache.find(user => user.id === uid);
    }

    // 2. Fallback to Network (if not in cache or forced refresh needed)
    if (!u) {
        // Show Loading Toast or Spinner if needed
        app.showToast('Carregando dados...');

        if (app.namedDb && window.firestoreUtils) {
            const { doc, getDoc } = window.firestoreUtils;
            const snap = await getDoc(doc(app.namedDb, 'users', uid));
            if (snap.exists()) u = snap.data();
        }

        if (!u) {
            const doc = await app.db.collection('users').doc(uid).get();
            if (doc.exists) u = doc.data();
        }
    }

    if (!u) return alert('Usuário não encontrado');

    // Helper for safe value
    const val = (v) => v || '';

    const content = `
        <div class="flex flex-col h-[65vh] md:h-[500px]">
            
            <!-- TABS HEADER -->
            <div class="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-700 pb-2 overflow-x-auto">
                <button onclick="app.switchAdminTab('personal')" data-tab="personal" 
                    class="admin-tab-btn px-4 py-2 rounded-lg text-sm font-bold transition-all bg-primary text-white shadow-md flex items-center gap-2 whitespace-nowrap">
                    <span class="material-icons-round text-lg">person</span> Pessoal
                </button>
                <button onclick="app.switchAdminTab('address')" data-tab="address" 
                    class="admin-tab-btn px-4 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap">
                    <span class="material-icons-round text-lg">place</span> Endereço
                </button>
                <button onclick="app.switchAdminTab('system')" data-tab="system" 
                    class="admin-tab-btn px-4 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap">
                    <span class="material-icons-round text-lg">settings</span> Sistema
                </button>
                 <button onclick="app.switchAdminTab('notes')" data-tab="notes" 
                    class="admin-tab-btn px-4 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap">
                    <span class="material-icons-round text-lg">description</span> Notas
                </button>
            </div>

            <!-- CONTENT AREA -->
            <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
                
                <!-- TAB 1: PESSOAL -->
                <div id="tab-personal" class="admin-tab-content space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-control col-span-full">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                            <input id="edit-user-name" type="text" value="${val(u.name)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                        </div>
                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">CPF</label>
                            <input id="edit-user-cpf" type="text" value="${val(u.cpf)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl" placeholder="000.000.000-00">
                        </div>
                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Data de Nascimento</label>
                            <input id="edit-user-birthdate" type="date" value="${val(u.birthdate)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                        </div>
                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Telefone / WhatsApp</label>
                            <input id="edit-user-phone" type="text" value="${val(u.phone)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl" placeholder="(00) 00000-0000">
                        </div>
                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">E-mail (Login)</label>
                            <input type="text" value="${val(u.email)}" class="input input-bordered w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 cursor-not-allowed" readonly>
                        </div>
                    </div>
                </div>

                <!-- TAB 2: ENDEREÇO -->
                <div id="tab-address" class="admin-tab-content hidden space-y-4">
                     <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div class="form-control md:col-span-2">
                            <label class="label text-xs font-bold text-slate-500 uppercase">CEP</label>
                            <input id="edit-user-cep" type="text" value="${val(u.cep)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl" placeholder="00000-000">
                        </div>
                        <div class="form-control md:col-span-4">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Logradouro (Rua, Av.)</label>
                            <input id="edit-user-address" type="text" value="${val(u.address)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                        </div>
                        <div class="form-control md:col-span-2">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Número</label>
                            <input id="edit-user-number" type="text" value="${val(u.number)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                        </div>
                        <div class="form-control md:col-span-4">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Bairro</label>
                            <input id="edit-user-district" type="text" value="${val(u.district)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                        </div>
                        <div class="form-control md:col-span-4">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Cidade</label>
                            <input id="edit-user-city" type="text" value="${val(u.city)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                        </div>
                        <div class="form-control md:col-span-2">
                            <label class="label text-xs font-bold text-slate-500 uppercase">UF</label>
                            <input id="edit-user-state" type="text" value="${val(u.state)}" class="input input-bordered w-full bg-white dark:bg-slate-900 rounded-xl" maxlength="2" placeholder="Ex: SP">
                        </div>
                    </div>
                </div>

                <!-- TAB 3: SISTEMA -->
                <div id="tab-system" class="admin-tab-content hidden space-y-4">
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Perfil (Role)</label>
                            <select id="edit-user-role" class="select select-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                                <option value="student" ${u.role === 'student' ? 'selected' : ''}>Aluno</option>
                                <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>Professor</option>
                                <option value="school" ${u.role === 'school' ? 'selected' : ''}>Escola</option>
                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
                            </select>
                        </div>

                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Status</label>
                             <select id="edit-user-status" class="select select-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                                <option value="active" ${(!u.status || u.status === 'active') ? 'selected' : ''}>Ativo</option>
                                <option value="suspended" ${u.status === 'suspended' ? 'selected' : ''}>Suspenso</option>
                                <option value="overdue" ${u.status === 'overdue' ? 'selected' : ''}>Inadimplente</option>
                            </select>
                        </div>

                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Instrumento Principal</label>
                            <select id="edit-user-instrument" class="select select-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                                <option value="-" ${!u.instrument ? 'selected' : ''}>- Selecione -</option>
                                <option value="Violão" ${u.instrument === 'Violão' ? 'selected' : ''}>Violão</option>
                                <option value="Guitarra" ${u.instrument === 'Guitarra' ? 'selected' : ''}>Guitarra</option>
                                <option value="Baixo" ${u.instrument === 'Baixo' ? 'selected' : ''}>Baixo</option>
                                <option value="Teclado" ${u.instrument === 'Teclado' ? 'selected' : ''}>Teclado</option>
                                <option value="Bateria" ${u.instrument === 'Bateria' ? 'selected' : ''}>Bateria</option>
                                <option value="Vocal" ${u.instrument === 'Vocal' ? 'selected' : ''}>Vocal</option>
                            </select>
                        </div>

                        <div class="form-control">
                            <label class="label text-xs font-bold text-slate-500 uppercase">Plano</label>
                            <select id="edit-user-plan" class="select select-bordered w-full bg-white dark:bg-slate-900 rounded-xl">
                                <option value="free" ${(!u.plan_id || u.plan_id === 'free') ? 'selected' : ''}>Free (Gratuito)</option>
                                <option value="student" ${u.plan_id === 'student' ? 'selected' : ''}>Aluno Pro</option>
                                <option value="professor_start" ${u.plan_id === 'professor_start' ? 'selected' : ''}>Professor Start</option>
                                <option value="professor_pro" ${u.plan_id === 'professor_pro' ? 'selected' : ''}>Professor Pro</option>
                                <option value="professor_elite" ${u.plan_id === 'professor_elite' ? 'selected' : ''}>Professor Elite</option>
                                <option value="school_basic" ${u.plan_id === 'school_basic' ? 'selected' : ''}>Escola Básico</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- TAB 4: NOTAS -->
                <div id="tab-notes" class="admin-tab-content hidden space-y-4">
                     <div class="form-control h-full">
                        <label class="label text-xs font-bold text-slate-500 uppercase">Observações (Interno)</label>
                        <textarea id="edit-user-notes" class="textarea textarea-bordered h-[300px] bg-white dark:bg-slate-900 rounded-xl w-full p-4" placeholder="Anotações sobre este usuário...">${val(u.notes)}</textarea>
                    </div>
                </div>

            </div>
        </div>
    `;

    app.modal({
        title: 'Editar Cadastro Completo',
        content: content,
        confirmText: 'Salvar Alterações',
        onConfirm: async () => {
            // Collect Data
            const updateData = {
                // Personal
                name: document.getElementById('edit-user-name').value,
                cpf: document.getElementById('edit-user-cpf').value,
                birthdate: document.getElementById('edit-user-birthdate').value,
                phone: document.getElementById('edit-user-phone').value,

                // Address
                cep: document.getElementById('edit-user-cep').value,
                address: document.getElementById('edit-user-address').value,
                number: document.getElementById('edit-user-number').value,
                district: document.getElementById('edit-user-district').value,
                city: document.getElementById('edit-user-city').value,
                state: document.getElementById('edit-user-state').value,

                // System
                role: document.getElementById('edit-user-role').value,
                instrument: document.getElementById('edit-user-instrument').value,
                plan_id: document.getElementById('edit-user-plan').value,
                status: document.getElementById('edit-user-status').value,

                // Extras
                notes: document.getElementById('edit-user-notes').value,

                updatedAt: new Date()
            };

            // Hybrid Update
            if (app.namedDb && window.firestoreUtils) {
                const { doc, updateDoc } = window.firestoreUtils;
                await updateDoc(doc(app.namedDb, 'users', uid), updateData);
            } else {
                await app.db.collection('users').doc(uid).update(updateData);
            }

            app.showToast('Cadastro atualizado com sucesso!');
            app.loadAdminUsers();
        }
    });
};

app.deleteUser = async (uid) => {
    if (!confirm('Tem certeza?')) return;
    try {
        await app.db.collection('users').doc(uid).delete();
        app.showToast('Usuário excluído.');
        app.loadAdminUsers();
    } catch (e) {
        alert(e.message);
    }
};
