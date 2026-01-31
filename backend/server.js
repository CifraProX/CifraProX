const express = require('express');
const cors = require('cors');
const db = require('./db');
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'segredo_super_secreto_cifrasprox'; // Em produção, usar .env

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Frontend (que está na pasta acima '..')
const path = require('path');
app.use(express.static(path.join(__dirname, '../')));

// Rota de Teste API
app.get('/ping', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Erro ao conectar no banco' });
    }
});

// --- ROTA TEMPORÁRIA PARA CRIAR ADMIN ---
app.get('/init-admin', async (req, res) => {
    try {
        const email = 'cifraprox@gmail.com';
        const password = 'projetoinfcifras';

        // Check exist
        const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (check.rows.length > 0) {
            await db.query(`
                UPDATE users 
                SET role = 'admin', status = 'active', password_hash = $1, plan_id = 4 
                WHERE email = $2`,
                [password, email]
            );
            return res.send(`<h1>Usuário ATUALIZADO com sucesso!</h1><p>Email: ${email}</p><p>Agora você pode fazer login.</p>`);
        } else {
            await db.query(
                `INSERT INTO users (name, email, password_hash, role, status, plan_id, instrument)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                ['Admin CifraProX', email, password, 'admin', 'active', 4, 'Violão']
            );
            return res.send(`<h1>Usuário CRIADO com sucesso!</h1><p>Email: ${email}</p><p>Agora você pode fazer login.</p>`);
        }
    } catch (err) {
        return res.status(500).send('Erro ao criar admin: ' + err.message);
    }
});

// --- ROTA TEMPORÁRIA PARA CRIAR ESCOLA ---
app.get('/init-school', async (req, res) => {
    try {
        const email = 'escola@teste.com';
        const password = '123456';

        // Check exist
        const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (check.rows.length > 0) {
            await db.query(`
                UPDATE users 
                SET role = 'school', status = 'active', password_hash = $1, plan_id = 4 
                WHERE email = $2`,
                [password, email]
            );
            return res.send(`<h1>✅ Usuário ESCOLA ATUALIZADO!</h1>
                <p><b>Email:</b> ${email}</p>
                <p><b>Senha:</b> ${password}</p>
                <p><b>Role:</b> school</p>
                <p>Agora você pode fazer login e acessar o dashboard de escola.</p>`);
        } else {
            await db.query(
                `INSERT INTO users (name, email, password_hash, role, status, plan_id, instrument)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                ['Escola Teste', email, password, 'school', 'active', 4, 'Violão']
            );
            return res.send(`<h1>✅ Usuário ESCOLA CRIADO!</h1>
                <p><b>Email:</b> ${email}</p>
                <p><b>Senha:</b> ${password}</p>
                <p><b>Role:</b> school</p>
                <p>Agora você pode fazer login e acessar o dashboard de escola.</p>`);
        }
    } catch (err) {
        return res.status(500).send('Erro ao criar escola: ' + err.message);
    }
});

// --- MIDDLEWARES ---
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ message: 'Token não fornecido' });

    // Aceita "Bearer TOKEN" ou apenas "TOKEN" para compatibilidade
    const actualToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

    jwt.verify(actualToken, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        req.user = user;
        next();
    });
}

function authorizeRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Acesso negado para este perfil.' });
        }
        next();
    };
}

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/auth/register', async (req, res) => {
    const { name, cpf, phone, instrument, email, password, type } = req.body; // type: 'student' | 'professor' | 'school'

    try {
        console.log('DEBUG: Register Start. Payload:', req.body); // LOG IMPORTANTISSIMO
        console.log('DEBUG: Request Type:', type);

        // Validação basica
        if (!email || !password || !type || !name) {
            return res.status(400).json({ message: 'Todos os campos obrigatórios (Nome, Email, Senha, Tipo) devem ser preenchidos.' });
        }

        // Verificar se usuário já existe
        const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ message: 'E-mail já cadastrado.' });
        }

        // Definir Role e Plan ID baseado no tipo escolhido
        let role = 'student';
        let plan_id = 1; // Básico (Aluno)

        if (type === 'professor_start') {
            role = 'professor';
            plan_id = 5; // Professor Start (8 acessos)
        } else if (type === 'professor_pro') {
            role = 'professor';
            plan_id = 6; // Professor Pro (15 acessos)
        } else if (type === 'professor_elite') {
            role = 'professor';
            plan_id = 7; // Professor Elite (25 acessos)
        } else if (type === 'school_basic') {
            role = 'school'; // Alterado de 'admin' para 'school'
            plan_id = 4; // Escola Básico (5 professores x 20 acessos)
        } else if (type === 'student') {
            plan_id = 1; // Aluno (Agora R$ 19,90) - mantendo ID 1
        }

        // Mapeamento de Links de Pagamento
        let redirectUrl = 'https://link.infinitepay.io/saulo-diogo/VC1D-iQVE8uHYZ-19,99'; // Default: Aluno

        if (type === 'professor_start') {
            redirectUrl = 'https://link.infinitepay.io/saulo-diogo/VC1D-1C2uUtKqEH-59,90';
        } else if (type === 'professor_pro') {
            redirectUrl = 'https://link.infinitepay.io/saulo-diogo/VC1D-7AHTpmxiuV-89,90';
        } else if (type === 'professor_elite') {
            redirectUrl = 'https://link.infinitepay.io/saulo-diogo/VC1D-3a8kcYiJUz-119,90';
        } else if (type === 'school_basic') {
            redirectUrl = 'https://link.infinitepay.io/saulo-diogo/VC1D-7AHW50WUA3-349,90';
        }

        const paymentDetails = {
            status: 'pending_payment',
            redirectUrl: redirectUrl
        };

        const statusForLogin = 'pending_payment'; // Blocks login

        const resultFinal = await db.query(
            `INSERT INTO users (name, cpf, phone, instrument, email, password_hash, role, plan_id, status, payment_status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, email, role, plan_id`,
            [name, cpf, phone, instrument, email, password, role, plan_id, statusForLogin, paymentDetails.status]
        );

        const newUser = resultFinal.rows[0];

        // Generate Token (Optional, maybe we only give token after payment? Or give token but it has role 'guest'?)
        // If we block login, this token might be useless for now, unless we auto-login after payment.
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, role: newUser.role, plan_id: newUser.plan_id },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Usuário criado com sucesso. Redirecionando para pagamento.',
            user: newUser,
            token,
            redirectUrl: paymentDetails.redirectUrl,
            paymentRequired: true
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar usuário', error: err.message });
    }
});

// --- FIREBASE ADMIN SETUP ---
const admin = require('firebase-admin');
// NOTE: For production, allow the environment to provide credentials (GOOGLE_APPLICATION_CREDENTIALS)
// OR require a serviceAccountKey.json file in the backend folder.
// For now, we try to initialize with default credentials or specific file if exists.
try {
    // Tenta carregar serviceAccountKey.json se existir
    // const serviceAccount = require('./serviceAccountKey.json');
    // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

    // Fallback: Default Application Credentials (common in Google Cloud / Firebase Hosting)
    if (!admin.apps.length) {
        admin.initializeApp();
        console.log("Firebase Admin Initialized (Default Credentials)");
    }
} catch (e) {
    console.warn("⚠️ Firebase Admin Setup Warning: Could not initialize. Webhook processing might fail if credentials are missing. Error:", e.message);
}

const firestore = admin.firestore();
const auth = admin.auth();

// ... existing code ...

// --- ROTA DE WEBHOOK (InfinitePay) ---
app.post('/webhooks/infinitepay', async (req, res) => {
    // 1. Authorization / Signature Validation
    // Como InfinitePay não usa API Key para este fluxo, a segurança depende de:
    // A) Segredo no Header (X-Webhook-Token) configurado na criação do link? (Se suportado)
    // B) Validação estrita do external_reference (Metadata) que DEVE existir no nosso banco.
    // C) Verificar IPs da InfinitePay (Opcional/Avançado)

    // Vamos confiar na presença e validade do external_reference pre-existente.
    // Se o ID não existe no nosso banco "pending", ignoramos.

    try {
        const payload = req.body;
        console.log('[WEBHOOK] Payload received:', JSON.stringify(payload, null, 2));

        // 2. Extract Data
        // Estrutura Típica v2: { event: "transaction.updated", data: { status: "approved", metadata: { external_reference: "..." } } }
        let status = payload.status || (payload.data && payload.data.status);
        let externalRef = payload.metadata?.external_reference || payload.data?.metadata?.external_reference;

        // Robustez: Se o payload vier diferente, tenta achar qualquer referência de ID
        if (!externalRef && payload.data && payload.data.order_id) externalRef = payload.data.order_id;

        console.log(`[WEBHOOK] Processing: Status=${status}, Ref=${externalRef}`);

        // 3. Status Check
        if (status !== 'approved' && status !== 'paid') {
            console.log('[WEBHOOK] Ignored: Payment not approved/paid.');
            return res.json({ status: 'ignored', reason: 'Status not approved' });
        }

        // 4. Idempotency & Processing
        if (!externalRef) {
            console.error('[WEBHOOK] Sem external_reference. Impossível vincular.');
            return res.status(400).json({ message: 'Missing metadata' });
        }

        const preRegId = externalRef;
        const docRef = firestore.collection('pre_registrations').doc(preRegId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            console.error('[WEBHOOK] Pre-registration not found:', preRegId);
            return res.status(404).json({ message: 'Pre-registration not found' });
        }

        const preRegDoc = { id: docRef.id, ...docSnap.data() };

        if (preRegDoc.status === 'completed') {
            console.log('[WEBHOOK] Idempotency: Registration already completed.');
            return res.json({ status: 'success', message: 'Already processed' });
        }

        // 5. Create Final User
        // 5.1 Create Firebase Auth
        let uid;
        try {
            const existingUser = await auth.getUserByEmail(preRegDoc.email);
            uid = existingUser.uid;
            await auth.updateUser(uid, { disabled: false });
        } catch (authErr) {
            if (authErr.code === 'auth/user-not-found') {
                const newUser = await auth.createUser({
                    email: preRegDoc.email,
                    password: preRegDoc.password,
                    displayName: preRegDoc.name,
                    disabled: false
                });
                uid = newUser.uid;
            } else {
                throw authErr;
            }
        }

        // 5.2 Create Firestore Profile
        const finalUserData = {
            name: preRegDoc.name,
            email: preRegDoc.email,
            role: preRegDoc.role,
            plan_id: preRegDoc.plan_id,
            cpf: preRegDoc.cpf || '',
            phone: preRegDoc.phone || '',
            instrument: preRegDoc.instrument || '',
            status: 'active',
            section: preRegDoc.section || 'student',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentId: payload.id || 'webhook_confirmed',
            paymentMethod: 'infinitepay',
            paymentDate: new Date().toISOString()
        };

        const userRef = firestore.collection('users').doc(uid);
        await userRef.set(finalUserData, { merge: true });

        // 5.3 Update Pre-Registration Status
        await firestore.collection('pre_registrations').doc(preRegId).update({
            status: 'completed',
            uid: uid,
            processedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[WEBHOOK] SUCCESS! User ${preRegDoc.email} fully activated.`);
        res.json({ status: 'success', uid: uid });

    } catch (err) {
        console.error('[WEBHOOK] Critical Error:', err);
        res.status(500).json({ status: 'error', error: err.message });
    }
});

// --- ROTA DE GERAÇÃO DE LINK (InfinitePay) ---
const axios = require('axios');
app.post('/auth/generate-payment-link', async (req, res) => {
    try {
        const { pre_registration_id } = req.body;

        if (!pre_registration_id) {
            return res.status(400).json({ message: 'Pre-registration ID required' });
        }

        // 1. Busca dados do pré-cadastro
        const docRef = firestore.collection('pre_registrations').doc(pre_registration_id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ message: 'Pre-cadastro não encontrado' });
        }

        const data = docSnap.data();

        // 2. Define Valor baseado no Plano
        let amount = 19.90; // Default
        if (data.plan_id === 2) amount = 59.90;
        if (data.plan_id === 3) amount = 89.90;
        if (data.plan_id === 4) amount = 119.90;
        if (data.plan_id === 5) amount = 349.90;

        // 3. Define Webhook URL
        // Em produção, isso deve ser 'https://api.cifraprox.com/webhooks/infinitepay'
        // Prioriza variável de ambiente. Se não existir, usa o host da requisição.
        // InfinitePay EXIGE HTTPS.

        const protocol = (req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1')) ? 'http' : 'https';

        const webhookUrl = process.env.WEBHOOK_BASE_URL
            ? `${process.env.WEBHOOK_BASE_URL}/webhooks/infinitepay`
            : `${protocol}://${req.get('host')}/webhooks/infinitepay`;

        console.log('[PAYMENT] Gerando link para:', data.email, 'Valor:', amount, 'Webhook:', webhookUrl);

        // 4. Chamada à API InfinitePay
        // Endpoint v2 para Links (Exemplo baseado na documentação padrão)
        const infinitePayUrl = 'https://api.infinitepay.io/v2/payment_links';

        const payload = {
            infinite_tag: "saulo-diogo", // Handle OBRIGATÓRIO
            amount: amount,
            title: `Assinatura CifraProX - ${data.role}`,
            customer: {
                email: data.email,
                first_name: data.name.split(' ')[0],
                last_name: data.name.split(' ').slice(1).join(' ') || 'User'
            },
            metadata: {
                external_reference: pre_registration_id, // ID PRE-CADASTRO (Chave da Idempotência)
                origin: "cifraprox_web"
            },
            webhook_url: webhookUrl // ONDE A MÁGICA ACONTECE
        };

        const response = await axios.post(infinitePayUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                // Sem Authorization Bearer, pois usa infinite_tag no body
            }
        });

        // 5. Retorna o Link gerado
        // A resposta geralmente contém { url: "https://pay.infinitepay.io/..." }
        const paymentUrl = response.data.url || response.data.link;

        if (!paymentUrl) {
            throw new Error('InfinitePay não retornou URL válida.');
        }

        // Atualiza pre-cadastro com o link gerado (opcional, bom para log)
        await docRef.update({ paymentLink: paymentUrl, paymentAmount: amount });

        res.json({ url: paymentUrl });

    } catch (error) {
        console.error('[PAYMENT-GEN] Erro:', error.response ? error.response.data : error.message);
        // Fallback para MVP: Se a API falhar (ex: localhost não aceito), retorna link estático
        // MAS avisa que é fallback.
        console.warn('Usando Link Estático como Fallback (API falhou).');
        res.json({
            url: 'https://invoice.infinitepay.io/plans/saulo-diogo/1nBPlUHLod',
            warning: 'API Error - Static Link Used'
        });
    }
});
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Buscar usuário e detalhes do plano
        const query = `
            SELECT u.*, p.name as plan_name, p.max_connections 
            FROM users u 
            LEFT JOIN plans p ON u.plan_id = p.id 
            WHERE u.email = $1
        `;
        const result = await db.query(query, [email]);
        const user = result.rows[0];

        if (user && user.password_hash === password) {

            if (user.status !== 'active') {
                return res.status(403).json({ message: 'Conta inativa ou suspensa. Contate o suporte.' });
            }

            // Gerar JWT
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, plan_id: user.plan_id },
                SECRET_KEY,
                { expiresIn: '24h' }
            );

            res.json({
                token: token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    plan_name: user.plan_name,
                    max_connections: user.max_connections
                }
            });
        } else {
            res.status(401).json({ message: 'E-mail ou senha incorretos' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
});

// --- API ESCOLA (Gestão de Professores) ---
app.get('/school/professors', authenticateToken, authorizeRole(['school']), async (req, res) => {
    try {
        // Assume 'school_id' linkage. For now, we link by who created them? 
        // Or we add 'school_id' to users table.
        // Let's assume we added 'school_id' column.
        const result = await db.query(`
            SELECT id, name, email, phone, instrument, status, last_payment
            FROM users 
            WHERE school_id = $1 AND role = 'professor'
        `, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao listar professores' });
    }
});

app.post('/school/professors', authenticateToken, authorizeRole(['school']), async (req, res) => {
    const { name, email, password, instrument } = req.body;
    try {
        // Enforce limits? (Check plan max_users?)
        // For MVP: Create user linked to school
        const role = 'professor';
        const plan_id = 5; // Default to Professor Start? Or inherit? Let's use 5.
        const status = 'active';
        const school_id = req.user.id; // Link to the logged-in School User

        // Check exist
        const check = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (check.rows.length > 0) return res.status(409).json({ message: 'Email já cadastrado.' });

        await db.query(`
            INSERT INTO users (name, email, password_hash, role, plan_id, status, instrument, school_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [name, email, password, role, plan_id, status, instrument, school_id]);

        res.status(201).json({ message: 'Professor criado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao criar professor' });
    }
});

app.put('/school/professors/:id', authenticateToken, authorizeRole(['school']), async (req, res) => {
    const { status } = req.body; // 'active' or 'inactive'
    const { id } = req.params;
    try {
        // Verify ownership
        const check = await db.query('SELECT id FROM users WHERE id = $1 AND school_id = $2', [id, req.user.id]);
        if (check.rows.length === 0) return res.status(403).json({ message: 'Professor não encontrado.' });

        await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
        res.json({ message: 'Status atualizado.' });
    } catch (err) {
        res.status(500).json({ message: 'Erro ao atualizar.' });
    }
});


// --- API ADMIN (Gestão de Usuários) ---
app.get('/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.name, u.email, u.phone, u.instrument, u.role, u.status, u.last_payment, u.plan_id, p.name as plan_name 
            FROM users u 
            LEFT JOIN plans p ON u.plan_id = p.id
            ORDER BY u.id ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/admin/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const { id } = req.params;
    const { role, plan_id, status } = req.body;

    try {
        await db.query(
            'UPDATE users SET role = COALESCE($1, role), plan_id = COALESCE($2, plan_id), status = COALESCE($3, status) WHERE id = $4',
            [role, plan_id, status, id]
        );
        res.json({ message: 'Usuário atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/admin/users/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/plans', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM plans WHERE is_active = TRUE');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/admin/users', authenticateToken, authorizeRole(['admin']), async (req, res) => {
    const { email, password, role, plan_id, status } = req.body;
    try {
        // Warning: Password plain text for now, as requested. Switch to bcrypt later.
        const result = await db.query(
            `INSERT INTO users (email, password_hash, role, plan_id, status) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email`,
            [email, password, role || 'student', plan_id, status || 'active']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API PROFESSOR (Sala de Aula) ---
app.post('/classrooms', authenticateToken, authorizeRole(['admin', 'professor']), async (req, res) => {
    try {
        // Verificar limite de conexões do plano
        const planRes = await db.query('SELECT max_connections FROM plans WHERE id = $1', [req.user.plan_id]);
        const maxConn = planRes.rows[0]?.max_connections || 5;

        // Gerar código curto
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Expira em 60 minutos
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        // Desativar sessões anteriores deste professor para evitar poluição
        await db.query('UPDATE classroom_sessions SET is_active = FALSE WHERE professor_id = $1', [req.user.id]);

        const result = await db.query(
            `INSERT INTO classroom_sessions (professor_id, code, expires_at, max_connections) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.user.id, code, expiresAt, maxConn]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint público para checar status (Polling do Professor ou Check inicial do aluno)
app.get('/classrooms/:code', async (req, res) => {
    const { code } = req.params;
    try {
        const result = await db.query(
            `SELECT * FROM classroom_sessions WHERE code = $1 AND expires_at > NOW() AND is_active = TRUE`,
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ valid: false, message: 'Sala não encontrada ou expirada.' });
        }

        res.json({ valid: true, session: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para Entrar na Sala (Incrementa contador 'active_connections')
app.post('/classrooms/:code/join', async (req, res) => {
    const { code } = req.params;
    try {
        // Transação simples para garantir atomicidade no check-and-update
        // Nota: Em alta escala usaria Redis, mas SQL UPDATE ... WHERE atende aqui.

        // 1. Tentar incrementar SÓ SE ainda tiver vaga
        const updateRes = await db.query(
            `UPDATE classroom_sessions 
             SET active_connections = active_connections + 1 
             WHERE code = $1 
               AND active_connections < max_connections 
               AND expires_at > NOW() 
               AND is_active = TRUE
             RETURNING *`,
            [code]
        );

        if (updateRes.rows.length === 0) {
            // Falhou: Ou não existe, ou expirou, ou TÁ CHEIO.
            // Vamos descobrir o motivo para dar erro melhor
            const check = await db.query('SELECT max_connections, active_connections FROM classroom_sessions WHERE code = $1', [code]);
            if (check.rows.length > 0) {
                const s = check.rows[0];
                if (s.active_connections >= s.max_connections) {
                    return res.status(429).json({ message: `Sala Cheia! Limite de ${s.max_connections} alunos atingido.` });
                }
            }
            return res.status(400).json({ message: 'Não foi possível entrar na sala (Expirada ou Inválida).' });
        }

        res.json({ success: true, session: updateRes.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CRUD Cifras (Protegido)
app.get('/cifras', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM cifras ORDER BY title ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/cifras', authenticateToken, authorizeRole(['admin', 'professor', 'student']), async (req, res) => {
    const { title, artist, content, tabs, tone, capo, genre, ready } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO cifras (title, artist, content, tabs, tone, capo, genre) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, artist, content, tabs, tone, capo, genre]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- STARTUP CHECKS ---
const initDB = async () => {
    try {
        // Migration: Add school_id to users if not exists
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS school_id INTEGER
        `);
        console.log('Database Schema Verified (school_id)');
    } catch (e) {
        console.warn('Schema check warning:', e.message);
    }
};

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
