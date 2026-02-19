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
    console.log('redirectToLogin called');
    if (app.state.pendingClassroomId) {
        localStorage.setItem('pendingClassroom', app.state.pendingClassroomId);
    }
    app.hideJoinClassroomModal();
    app.showToast('Por favor, faça login para acessar a sala.');
    app.navigate('home');
};

app.showLoginFromJoin = () => {
    console.log('[AUTH] showLoginFromJoin called');
    // Save pending classroom if exists
    if (app.state.pendingClassroomId) {
        localStorage.setItem('pendingClassroom', app.state.pendingClassroomId);
        console.log('[AUTH] Saved pending classroom:', app.state.pendingClassroomId);
    }
    // Hide the join modal
    app.hideJoinClassroomModal();
    // Navigate to login
    app.navigate('login');
};


app.loginAsGuest = async (guestName) => {
    if (!guestName) return;

    console.log('[AUTH] Logging in as Guest:', guestName);

    // MOCK ANONYMOUS AUTH (Phase 1)
    // In Phase 2, this would be: await firebase.auth().signInAnonymously();

    const guestUser = {
        uid: 'guest_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: guestName,
        email: null,
        role: 'guest',
        isGuest: true,
        photoURL: null
    };

    // Update State
    app.state.user = guestUser;

    // Persist simple session (if we want to survive refresh without real auth)
    // For now, app_core.js handles restoring "guestName" from localStorage, 
    // but better to have a session marker.
    localStorage.setItem('guest_session', JSON.stringify(guestUser));

    // UI Feedback
    app.showToast(`Bem-vindo, ${guestName}! (Modo Visitante)`);
    app.updateHeader();

    return guestUser;
};

app.register = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerText : 'Criar Conta';

    try {
        if (btn) {
            btn.innerText = 'Criando...';
            btn.disabled = true;
        }

        // 1. Get Values (Using Correct IDs)
        const nameEl = document.getElementById('reg-name');
        const emailEl = document.getElementById('reg-email');
        const passwordEl = document.getElementById('reg-password');
        const cpfEl = document.getElementById('reg-cpf');
        const phoneEl = document.getElementById('reg-phone');
        const instrumentEl = document.getElementById('reg-instrument');
        // Radio for Plan/Type
        const typeEl = document.querySelector('input[name="type"]:checked');

        if (!nameEl || !emailEl || !passwordEl) {
            throw new Error('Campos obrigatórios não encontrados no formulário.');
        }

        const name = nameEl.value;
        const email = emailEl.value;
        const password = passwordEl.value;
        const cpf = cpfEl ? cpfEl.value : '';
        const phone = phoneEl ? phoneEl.value : '';
        const instrument = instrumentEl ? instrumentEl.value : '';
        const plan_id = typeEl ? typeEl.value : 'student';

        // 2. Validate
        if (password.length < 6) {
            throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }

        // 3. Create Auth User
        console.log('[REGISTER] Creating Auth User...');
        const userCredential = await app.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('[REGISTER] Auth success. UID:', user.uid);

        // 4. Update Profile
        await user.updateProfile({ displayName: name });

        // 5. Save to Firestore
        const userData = {
            name: name,
            email: email,
            role: 'student', // Default role
            cpf: cpf,
            phone: phone,
            instrument: instrument,
            plan_id: plan_id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        };

        console.log('[REGISTER] Saving to Firestore:', userData);

        // Try Named DB first, fallback to Default
        try {
            if (app.namedDb && window.firestoreUtils) {
                const { doc, setDoc } = window.firestoreUtils;
                await setDoc(doc(app.namedDb, 'users', user.uid), userData);
            } else {
                await app.db.collection('users').doc(user.uid).set(userData);
            }
        } catch (dbError) {
            console.error('[REGISTER] Firestore Error (Non-fatal for Auth):', dbError);
            app.showToast('Conta criada, mas houve um erro ao salvar dados extras.');
            // Continue to let user login
        }

        app.showToast('Conta criada com sucesso!');
        app.navigate('home');

    } catch (error) {
        console.error('[REGISTER] ERROR:', error);

        // Handle specific Firebase errors
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = 'Este e-mail já está cadastrado.';
        if (error.code === 'auth/weak-password') msg = 'A senha é muito fraca.';
        if (error.code === 'auth/invalid-email') msg = 'E-mail inválido.';

        app.showToast('Erro: ' + msg);

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
        localStorage.removeItem('guest_session'); // Clear Guest Session
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

// --- GUEST LOGIN (Anonymous Auth) ---
app.loginAsGuest = async (name) => {
    console.log('[AUTH] Logging in as guest:', name);
    try {
        // 1. Authenticate Anonymously via Firebase
        const userCredential = await app.auth.signInAnonymously();
        const user = userCredential.user;

        console.log('[AUTH] Guest authenticated. UID:', user.uid);

        // 2. Update Profile (DisplayName)
        await user.updateProfile({ displayName: name });

        // 3. Set Local State
        app.state.user = {
            uid: user.uid,
            name: name,
            email: null,
            role: 'guest',
            isGuest: true,
            photoURL: null
        };

        // 4. Persist Local Session (for offline/refresh)
        localStorage.setItem('guestName', name);
        localStorage.setItem('guest_session', JSON.stringify(app.state.user));

        app.showToast(`Bem-vindo, ${name}!`);
        app.updateHeader();

    } catch (error) {
        console.error('[AUTH] Guest Login Error:', error);

        // Fallback: Offline Guest
        const fakeUid = 'guest_' + Date.now();
        console.warn('[AUTH] Using offline fallback for guest. UID:', fakeUid);

        app.state.user = {
            uid: fakeUid,
            name: name,
            role: 'guest',
            isGuest: true
        };
        localStorage.setItem('guestName', name);
        localStorage.setItem('guest_session', JSON.stringify(app.state.user));
    }
};
