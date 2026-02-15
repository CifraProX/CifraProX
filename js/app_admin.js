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

app.editUser = async (uid) => {
    // Hybrid Fetch
    let u = null;
    if (app.namedDb && window.firestoreUtils) {
        const { doc, getDoc } = window.firestoreUtils;
        const snap = await getDoc(doc(app.namedDb, 'users', uid));
        if (snap.exists()) u = snap.data();
    }

    if (!u) {
        const doc = await app.db.collection('users').doc(uid).get();
        if (doc.exists) u = doc.data();
    }

    if (!u) return alert('Usuário não encontrado');

    const content = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control col-span-full">
                <label class="label font-bold text-sm text-slate-500">Nome do Usuário</label>
                <input id="edit-user-name" type="text" value="${u.name || ''}" class="input input-bordered w-full bg-slate-50 dark:bg-slate-700 rounded-xl" placeholder="Nome completo">
            </div>

            <div class="form-control">
                <label class="label font-bold text-sm text-slate-500">Perfil (Role)</label>
                <select id="edit-user-role" class="select select-bordered w-full bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <option value="student" ${u.role === 'student' ? 'selected' : ''}>Aluno</option>
                    <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>Professor</option>
                    <option value="school" ${u.role === 'school' ? 'selected' : ''}>Escola</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
                </select>
            </div>

            <div class="form-control">
                <label class="label font-bold text-sm text-slate-500">Instrumento</label>
                <select id="edit-user-instrument" class="select select-bordered w-full bg-slate-50 dark:bg-slate-700 rounded-xl">
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
                <label class="label font-bold text-sm text-slate-500">Plano</label>
                <select id="edit-user-plan" class="select select-bordered w-full bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <option value="free" ${(!u.plan_id || u.plan_id === 'free') ? 'selected' : ''}>Free (Gratuito)</option>
                    <option value="student" ${u.plan_id === 'student' ? 'selected' : ''}>Aluno Pro</option>
                    <option value="professor_start" ${u.plan_id === 'professor_start' ? 'selected' : ''}>Professor Start</option>
                    <option value="professor_pro" ${u.plan_id === 'professor_pro' ? 'selected' : ''}>Professor Pro</option>
                    <option value="professor_elite" ${u.plan_id === 'professor_elite' ? 'selected' : ''}>Professor Elite</option>
                    <option value="school_basic" ${u.plan_id === 'school_basic' ? 'selected' : ''}>Escola Básico</option>
                </select>
            </div>

            <div class="form-control">
                <label class="label font-bold text-sm text-slate-500">Status</label>
                <select id="edit-user-status" class="select select-bordered w-full bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <option value="active" ${(!u.status || u.status === 'active') ? 'selected' : ''}>Ativo</option>
                    <option value="suspended" ${u.status === 'suspended' ? 'selected' : ''}>Suspenso</option>
                    <option value="overdue" ${u.status === 'overdue' ? 'selected' : ''}>Inadimplente</option>
                </select>
            </div>
        </div >
                `;

    app.modal({
        title: 'Editar Usuário',
        content: content,
        confirmText: 'Salvar Alterações',
        onConfirm: async () => {
            const newName = document.getElementById('edit-user-name').value;
            const newRole = document.getElementById('edit-user-role').value;
            const newInstrument = document.getElementById('edit-user-instrument').value;
            const newPlan = document.getElementById('edit-user-plan').value;
            const newStatus = document.getElementById('edit-user-status').value;

            const updateData = {
                name: newName,
                role: newRole,
                instrument: newInstrument,
                plan_id: newPlan,
                status: newStatus
            };

            // Hybrid Update
            if (app.namedDb && window.firestoreUtils) {
                const { doc, updateDoc } = window.firestoreUtils;
                await updateDoc(doc(app.namedDb, 'users', uid), updateData);
            } else {
                await app.db.collection('users').doc(uid).update(updateData);
            }

            app.showToast('Usuário atualizado com sucesso!');
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
