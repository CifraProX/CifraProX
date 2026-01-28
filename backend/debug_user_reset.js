const admin = require('firebase-admin');
const serviceAccount = require('../cifraprox-270126-firebase-adminsdk-fbsvc-1d205b36a0.json');

// Initialize Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const { getFirestore } = require('firebase-admin/firestore');

// CONNECT TO 'cifraprox' DATABASE
const firestore = getFirestore(admin.app(), 'cifraprox');
const auth = admin.auth();

const TARGET_EMAIL = 'cifraprox@gmail.com';
const NEW_PASSWORD = 'projetoinfcifras';

async function run() {
    console.log(`\n--- Verificando Usurio: ${TARGET_EMAIL} ---\n`);

    try {
        // 1. Check Auth
        let uid;
        try {
            const userRecord = await auth.getUserByEmail(TARGET_EMAIL);
            uid = userRecord.uid;
            console.log(`✅ [AUTH] Usuário encontrado!`);
            console.log(`   UID: ${uid}`);
            console.log(`   Email: ${userRecord.email}`);
        } catch (e) {
            console.error(`❌ [AUTH] Usuário NÃO encontrado no Authentication:`, e.message);
            process.exit(1);
        }

        // 2. Check Firestore (cifraprox DB)
        try {
            const docRef = firestore.collection('users').doc(uid);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                console.log(`✅ [FIRESTORE - cifraprox] Perfil encontrado!`);
                console.log(`   Dados:`, docSnap.data());
            } else {
                console.warn(`⚠️ [FIRESTORE - cifraprox] Perfil NÃO existe para este UID!`);
                console.log(`   (O login deveria criar automaticamente, mas vamos criar aqui para garantir)`);

                await docRef.set({
                    email: TARGET_EMAIL,
                    name: 'Admin CifraProX',
                    role: 'admin',
                    plan_id: 4,
                    status: 'active',
                    section: 'admin',
                    restoredByScript: true,
                    migratedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`   ✅ Perfil criado manualmente agora.`);
            }
        } catch (e) {
            console.error(`❌ [FIRESTORE] Erro ao consultar banco:`, e.message);
        }

        // 3. Reset Password
        try {
            await auth.updateUser(uid, {
                password: NEW_PASSWORD
            });
            console.log(`\n✅ [PASSWORD] Senha alterada com sucesso para: ${NEW_PASSWORD}`);
        } catch (e) {
            console.error(`❌ [PASSWORD] Erro ao alterar senha:`, e.message);
        }

    } catch (error) {
        console.error('Erro Fatal:', error);
    }
}

run();
