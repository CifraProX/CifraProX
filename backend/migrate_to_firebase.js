const admin = require('firebase-admin');
const db = require('./db'); // PostgreSQL connection

// --- CONFIGURAÇÃO ---
// 1. Você precisa gerar uma chave privada no Console do Firebase:
//    Configurações do Projeto -> Contas de Serviço -> Gerar nova chave privada
// 2. Salve o arquivo como 'serviceAccountKey.json' na pasta 'backend'
// 3. OU cole o conteúdo do JSON aqui:
const serviceAccount = require('../cifraprox-270126-firebase-adminsdk-fbsvc-1d205b36a0.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const { getFirestore } = require('firebase-admin/firestore');

const firestore = getFirestore(admin.app(), 'cifraprox');
const auth = admin.auth();

async function migrate() {
    try {
        console.log('--- Iniciando Migração para Firebase ---');

        // 1. Ler usuários do Postgres
        const res = await db.query(`
            SELECT u.*, p.name as plan_name 
            FROM users u 
            LEFT JOIN plans p ON u.plan_id = p.id
        `);
        const users = res.rows;

        console.log(`Encontrados ${users.length} usuários no Postgres.`);

        for (const user of users) {
            console.log(`Processando: ${user.email}...`);

            let uid = null;

            // 2. Tentar criar usuário no Auth
            try {
                // Verificar se já existe
                try {
                    const existingUser = await auth.getUserByEmail(user.email);
                    uid = existingUser.uid;
                    console.log(`   -> Usuário Auth já existe (UID: ${uid})`);
                } catch (e) {
                    if (e.code === 'auth/user-not-found') {
                        // Criar novo
                        const newUser = await auth.createUser({
                            email: user.email,
                            emailVerified: true,
                            password: 'mudar123', // Senha temporária
                            displayName: user.name || 'Sem Nome',
                            disabled: user.status !== 'active'
                        });
                        uid = newUser.uid;
                        console.log(`   -> Criado no Auth (UID: ${uid})`);
                    } else {
                        throw e;
                    }
                }

                // 3. Salvar dados no Firestore (users/{uid})
                await firestore.collection('users').doc(uid).set({
                    email: user.email,
                    name: user.name || '',
                    role: user.role || 'student',
                    plan_id: user.plan_id || 1,
                    // plan_name: user.plan_name, // Opcional, melhor usar ID para lógica
                    section: user.role === 'admin' ? 'admin' : (user.role === 'school' ? 'school' : 'student'),
                    status: user.status || 'active',
                    instrument: user.instrument || '',
                    phone: user.phone || '',
                    migratedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                console.log(`   -> Dados salvos no Firestore.`);

            } catch (err) {
                console.error(`ERROR migrando ${user.email}:`, err.message);
            }
        }

        console.log('--- Migração Concluída ---');
        process.exit(0);

    } catch (e) {
        console.error('Erro Fatal:', e);
        process.exit(1);
    }
}

migrate();
