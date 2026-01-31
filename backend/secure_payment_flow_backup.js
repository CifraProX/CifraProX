
// ==================================================================================
// BACKUP: FLUXO SEGURO DE PAGAMENTO (WEBHOOK + LINK DINÂMICO)
// ==================================================================================
// Este código estava em CifraProX/app_v2.js -> register()
// Ele implementa a criação de usuários somente após confirmação do Webhook.
// Foi revertido temporariamente para permitir o fluxo simplificado (confiança no cliente).

/*
    register: async (e) => {
        if (e) e.preventDefault();
        
        // ... (Coleta de dados do formulário: email, password, name, type, cpf, etc) ...

        // Lógica de Determinação de Plano/Role
        let role = 'student';
        let plan_id = 1;
        if (type.includes('professor')) {
                role = 'school';
                if (type === 'professor_start') plan_id = 2;
                if (type === 'professor_pro') plan_id = 3;
                if (type === 'professor_elite') plan_id = 4;
        } else if (type.includes('school')) {
                role = 'school';
                plan_id = 5;
        }

        // 1. SAVE PRE-REGISTRATION (Status: Pending)
        console.log('[REGISTER] Iniciando Pré-Cadastro Seguro...');
        
        const preRegData = {
            email: email,
            password: password, 
            name: name,
            role: role,
            plan_id: plan_id,
            cpf: cpf,
            phone: phone,
            instrument: instrument,
            status: 'pending', // Waiting for Webhook
            createdAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        // Hybrid DB Check
        let dbUtils = (window.firestoreBridge && window.firestoreBridge.utils) ? window.firestoreBridge.utils : window.firestoreUtils;
        let preRegId;

        if (app.namedDb && dbUtils) {
            const { collection, addDoc } = dbUtils;
            const docRef = await addDoc(collection(app.namedDb, 'pre_registrations'), preRegData);
            preRegId = docRef.id;
        } else {
            const docRef = await app.db.collection('pre_registrations').add(preRegData);
            preRegId = docRef.id;
        }

        // 2. GENERATE DYNAMIC PAYMENT LINK (Backend Call)
        app.showToast('Gerando link de pagamento seguro...');
        
        let paymentLink;
        try {
            const apiBase = app.API_URL || ''; 
            const linkRes = await fetch(`${apiBase}/auth/generate-payment-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pre_registration_id: preRegId })
            });
            const linkData = await linkRes.json();
            if (linkData.url) paymentLink = linkData.url;
            else throw new Error('Falha ao gerar link');
        } catch (apiErr) {
            console.error(apiErr);
            paymentLink = 'https://invoice.infinitepay.io/plans/saulo-diogo/1nBPlUHLod'; // Fallback
        }

        const content = ` ... HTML do Modal de Pagamento ... `;

        app.modal({
            title: 'Quase lá! 🚀',
            content: content,
            confirmText: 'Fechar e Aguardar',
            onConfirm: () => {
                app.navigate('login');
                app.showToast('Aguardando confirmação do banco...');
            }
        });
    }
*/
