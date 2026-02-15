// --- AUTH MODULE ---
app.authModule = {};

app.login = async (e) => {
    e.preventDefault();
    console.log('[LOGIN] Iniciando processo de login...');

    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        console.log('[LOGIN] Chamando signInWithEmailAndPassword...');
        const userCredential = await app.auth.signInWithEmailAndPassword(email, password);
        console.log('[LOGIN] Auth bem-sucedido. UID:', userCredential.user.uid);

        console.log('[LOGIN] Obtendo token...');
        const token = await userCredential.user.getIdToken();
        localStorage.setItem('token', token);
        console.log('[LOGIN] Token salvo.');

        // Fetch User Role
        // Fetch User Role
        console.log('[LOGIN] Buscando dados do usuário no Firestore...');
        let userData = null;

        try {
            // STRATEGY 1: Try Named DB (Bridge/Modular) first
            if (app.namedDb && window.firestoreUtils) {
                console.log('[LOGIN] Usando Banco Nomeado (Bridge)...');
                const { doc, getDoc } = window.firestoreUtils;
                const userRef = doc(app.namedDb, 'users', userCredential.user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    userData = userSnap.data();
                    console.log('[LOGIN] Dados encontrados no Banco Nomeado.');
                } else {
                    console.log('[LOGIN] Usuário não encontrado no Banco Nomeado.');
                }
            }

            // STRATEGY 2: Fallback to Default DB (Compat)
            if (!userData) {
                console.log('[LOGIN] Tentando Banco Default (Compat)...');
                const doc = await app.db.collection('users').doc(userCredential.user.uid).get();
                if (doc.exists) {
                    userData = doc.data();
                    console.log('[LOGIN] Dados encontrados no Banco Default.');
                }
            }

        } catch (dbError) {
            console.error('[LOGIN] Erro ao buscar no Firestore:', dbError);
            // Não bloquear login se DB falhar, usar fallback
            userData = null;
        }

        if (!userData) {
            console.warn('[LOGIN] Usuário sem dados no Banco. Usando fallback.');
            userData = { role: 'student', name: 'Usuário', email: email };

            // Auto-create user in Named DB if missing? (Optional, maybe later)
        }

        // FORCE ADMIN for master account
        if (email === 'cifraprox@gmail.com') {
            userData.role = 'admin';
            console.log('[LOGIN] Superusuário detectado. Forçando role: admin');
        }

        app.state.user = { uid: userCredential.user.uid, ...userData };
        console.log('[LOGIN] Estado do usuário atualizado:', app.state.user);

        app.showToast(`Bem-vindo de volta, ${userData.name}!`);

        // Check pending classroom redirect
        const pendingClassroom = localStorage.getItem('pendingClassroom');
        if (pendingClassroom) {
            console.log('[LOGIN] Redirecionando para sala pendente:', pendingClassroom);
            localStorage.removeItem('pendingClassroom');
            app.navigate('classroom', pendingClassroom);
            return;
        }

        console.log('[LOGIN] Navegando para home/admin...');
        if (userData.role === 'admin') app.navigate('admin');
        else app.navigate('home');

    } catch (error) {
        console.error('[LOGIN] ERRO:', error);
        app.showToast('Erro ao entrar: ' + error.message);
    } finally {
        console.log('[LOGIN] Finalizando UI do botão.');
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
};

app.redirectToLogin = () => {
    if (app.state.pendingClassroomId) {
        localStorage.setItem('pendingClassroom', app.state.pendingClassroomId);
    }
    app.hideJoinClassroomModal();
    app.navigate('login');
};

app.register = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : 'Criar Conta';

    if (btn) {
        btn.innerText = 'Criando...';
        btn.disabled = true;
    }

    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPass = document.getElementById('register-confirm-password').value;

    if (password !== confirmPass) {
        app.showToast('Senhas não conferem!');
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
        return;
    }

    try {
        const userCredential = await app.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: name });

        // Save to Firestore
        await app.db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            role: 'student',
            plan_id: 1, // Free
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        app.showToast('Conta criada com sucesso!');
        app.navigate('home');

    } catch (error) {
        console.error(error);
        app.showToast('Erro ao criar conta: ' + error.message);
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
};

app.logout = () => {
    app.auth.signOut().then(() => {
        app.showToast('Você saiu.');
        localStorage.removeItem('token');
        app.navigate('login');
    });
};

app.changePassword = async () => {
    const user = app.auth.currentUser;
    if (!user) {
        app.showToast('Erro: Usuário não identificado.');
        return;
    }
    if (confirm(`Deseja enviar um e-mail de redefinição de senha para ${user.email}?`)) {
        try {
            await app.auth.sendPasswordResetEmail(user.email);
            app.showToast('E-mail enviado! Verifique sua caixa de entrada (e spam).');
        } catch (error) {
            console.error('Password Reset Error:', error);
            app.showToast('Erro ao enviar e-mail: ' + error.message);
        }
    }
};
