// --- PROFILE MODULE ---
app.profile = {
    currentTab: 'overview',
    tabs: [
        { id: 'overview', label: 'Visão Geral', icon: 'person' },
        { id: 'subscription', label: 'Assinatura', icon: 'credit_card' },
        { id: 'security', label: 'Segurança', icon: 'security' },
        { id: 'settings', label: 'Preferências', icon: 'settings' }
    ]
};

app.loadProfile = async () => {
    const container = document.getElementById('profile-content-area');
    if (!container) return; // Should be called after rendering view-profile

    // Render Tabs & Initial Content
    app.renderProfileTabs();
    app.switchProfileTab(app.profile.currentTab);
};

app.renderProfileTabs = () => {
    const tabContainer = document.getElementById('profile-tabs');
    if (!tabContainer) return;

    tabContainer.innerHTML = app.profile.tabs.map(tab => `
        <button onclick="app.switchProfileTab('${tab.id}')" 
            id="tab-${tab.id}"
            class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${app.profile.currentTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}">
            <span class="material-icons-round text-lg">${tab.icon}</span>
            <span class="hidden sm:inline">${tab.label}</span>
        </button>
    `).join('');
};

app.switchProfileTab = (tabId) => {
    app.profile.currentTab = tabId;
    app.renderProfileTabs(); // Re-render to update active state

    const content = document.getElementById('profile-tab-content');
    if (!content) return;

    // Show Loading
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-slate-400 animate-pulse">
            <span class="material-icons-round text-4xl mb-4">hourglass_top</span>
            <p>Carregando...</p>
        </div>
    `;

    // Simulate delay for effect
    setTimeout(() => {
        if (tabId === 'overview') app.renderProfileOverview(content);
        else if (tabId === 'subscription') app.renderProfileSubscription(content);
        else if (tabId === 'security') app.renderProfileSecurity(content);
        else if (tabId === 'settings') app.renderProfileSettings(content);
    }, 300);
};

// --- PRENDERERS ---

app.renderProfileOverview = (container) => {
    const user = app.state.user || {};
    const planName = user.role === 'admin' ? 'Administrador' : (user.plan_id === 5 ? 'Escola' : (user.plan_id === 1 ? 'Premium' : 'Gratuito'));

    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Profile Card -->
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
                    <div class="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl font-bold text-slate-400">
                        ${(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1 text-center md:text-left">
                        <h2 class="text-2xl font-bold text-slate-800 dark:text-white mb-1">${user.displayName || 'Usuário Sem Nome'}</h2>
                        <p class="text-slate-500 dark:text-slate-400 mb-4">${user.email}</p>
                        <div class="flex flex-wrap justify-center md:justify-start gap-2">
                             <span class="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-xs font-bold uppercase tracking-wider">
                                ${planName}
                             </span>
                             <span class="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider">
                                Ativo
                             </span>
                        </div>
                    </div>
                </div>

                <!-- Stats -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <p class="text-xs font-bold text-slate-400 uppercase mb-2">Cifras Salvas</p>
                        <p class="text-3xl font-bold text-slate-800 dark:text-white">12</p>
                    </div>
                    <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <p class="text-xs font-bold text-slate-400 uppercase mb-2">Salas Ativas</p>
                        <p class="text-3xl font-bold text-slate-800 dark:text-white">3</p>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="space-y-4">
                <div class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    <h3 class="font-bold text-slate-800 dark:text-white mb-4">Acesso Rápido</h3>
                    <button onclick="app.switchProfileTab('security')" class="w-full text-left py-3 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-colors flex items-center justify-between group mb-2">
                        <span class="text-sm font-bold text-slate-600 dark:text-slate-300">Alterar Senha</span>
                        <span class="material-icons-round text-slate-400 group-hover:text-primary">arrow_forward</span>
                    </button>
                    <button onclick="app.navigate('school')" class="w-full text-left py-3 px-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-colors flex items-center justify-between group">
                        <span class="text-sm font-bold text-slate-600 dark:text-slate-300">Ir para Minhas Salas</span>
                        <span class="material-icons-round text-slate-400 group-hover:text-primary">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    `;
};

app.renderProfileSubscription = (container) => {
    container.innerHTML = `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="p-8 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-500 to-indigo-600 relative overflow-hidden">
                <div class="relative z-10 text-white">
                    <p class="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">Seu Plano Atual</p>
                    <h2 class="text-3xl font-bold mb-2">CifraProX Premium</h2>
                    <p class="opacity-90">Renova em 15 de Março de 2026</p>
                </div>
                <span class="material-icons-round absolute -right-8 -bottom-16 text-9xl text-white opacity-10">verified</span>
            </div>
            
            <div class="p-8">
                <div class="flex flex-col md:flex-row gap-8">
                    <div class="flex-1 space-y-6">
                        <h3 class="font-bold text-lg text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Detalhes</h3>
                        <div class="space-y-4">
                            <div class="flex justify-between">
                                <span class="text-slate-500">Valor</span>
                                <span class="font-bold text-slate-800 dark:text-white">R$ 29,90 / mês</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-500">Status</span>
                                <span class="text-emerald-500 font-bold flex items-center gap-1"><span class="material-icons-round text-sm">check_circle</span> Ativo</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-500">Método de Pagamento</span>
                                <span class="text-slate-800 dark:text-white font-medium flex items-center gap-2"><span class="material-icons-round text-slate-400">credit_card</span> •••• 4242</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="w-px bg-slate-100 dark:bg-slate-700 hidden md:block"></div>

                    <div class="flex-1 space-y-6">
                         <h3 class="font-bold text-lg text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Gerenciar</h3>
                         <button class="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 font-bold text-slate-600 dark:text-slate-300 transition-colors">
                            Alterar Cartão
                         </button>
                         <button class="w-full py-3 rounded-xl border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold transition-colors">
                            Cancelar Assinatura
                         </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

app.renderProfileSecurity = (container) => {
    container.innerHTML = `
        <div class="max-w-2xl mx-auto space-y-8">
            <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <span class="material-icons-round text-primary">lock</span> Senha e Acesso
                </h3>
                
                <div class="space-y-4">
                    <button onclick="app.changePassword()" class="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 dark:text-white">Alterar Senha</p>
                            <p class="text-xs text-slate-500">Última alteração há 3 meses</p>
                        </div>
                        <span class="material-icons-round text-slate-300 group-hover:text-primary">chevron_right</span>
                    </button>

                    <div class="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div class="text-left">
                            <p class="font-bold text-slate-800 dark:text-white">Autenticação de Dois Fatores (2FA)</p>
                            <p class="text-xs text-slate-500">Adicione uma camada extra de segurança</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" value="" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                 <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <span class="material-icons-round text-slate-400">devices</span> Sessões Ativas
                </h3>
                <div class="space-y-4">
                    <div class="flex items-center gap-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                        <span class="material-icons-round text-emerald-500 text-2xl">desktop_windows</span>
                        <div class="flex-1">
                            <p class="font-bold text-slate-800 dark:text-white text-sm">Windows 10 • Chrome</p>
                            <p class="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Dispositivo Atual</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4 p-3">
                         <span class="material-icons-round text-slate-300 text-2xl">smartphone</span>
                        <div class="flex-1">
                            <p class="font-bold text-slate-800 dark:text-white text-sm">iPhone 13 • Safari</p>
                            <p class="text-xs text-slate-500">São Paulo, BR • Há 2 horas</p>
                        </div>
                        <button class="text-red-500 hover:text-red-700 text-xs font-bold uppercase">Sair</button>
                    </div>
                </div>
            </div>
        </div>
     `;
};

app.renderProfileSettings = (container) => {
    container.innerHTML = `
        <div class="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700">
             <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-6">Preferências do App</h3>
             
             <div class="space-y-6">
                <!-- Dark Mode -->
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-bold text-slate-800 dark:text-white">Modo Escuro</p>
                        <p class="text-xs text-slate-500">Alternar tema do aplicativo</p>
                    </div>
                    <button onclick="app.toggleTheme()" class="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        <span class="material-symbols-rounded">dark_mode</span>
                    </button>
                </div>

                <hr class="border-slate-100 dark:border-slate-700">

                <!-- Notifications -->
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-bold text-slate-800 dark:text-white">Notificações por Email</p>
                        <p class="text-xs text-slate-500">Resumos semanais e alertas de segurança</p>
                    </div>
                     <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" value="" class="sr-only peer" checked>
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>
                 <div class="flex items-center justify-between">
                    <div>
                        <p class="font-bold text-slate-800 dark:text-white">Novidades e Ofertas</p>
                        <p class="text-xs text-slate-500">Receber novidades sobre o CifraProX</p>
                    </div>
                     <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" value="" class="sr-only peer">
                        <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                <hr class="border-slate-100 dark:border-slate-700">
                
                <h3 class="font-bold text-lg text-red-500 mt-8 mb-4">Zona de Perigo</h3>
                <button onclick="app.logout()" class="w-full border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                    Sair da Conta
                </button>
             </div>
        </div>
    `;
};
