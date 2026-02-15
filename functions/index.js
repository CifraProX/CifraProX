const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// --- MIDDLEWARES ---

// Validar Token de Autenticação
const validateFirebaseIdToken = async (req, res, next) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return res.status(403).send('Unauthorized');
    }

    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
        const decodedIdToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedIdToken;
        next();
    } catch (error) {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    }
};

// Validar se é Professor ou Escola
const requireProfessor = async (req, res, next) => {
    // Busca user no Firestore para garantir role atualizada (Claims do token podem estar desatualizadas)
    // Para performance, poderíamos usar claims, mas vamos buscar no banco por segurança.
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) return res.status(403).send('User profile not found');

        const userData = userDoc.data();
        const role = userData.role;

        // Roles permitidas: professor, school, admin
        if (['professor', 'school', 'admin'].includes(role)) {
            req.userRole = role;
            req.userName = userData.name || 'Professor'; // Store for usage
            next();
        } else {
            res.status(403).send('Apenas professores podem realizar esta ação.');
        }
    } catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
};


// --- ROTAS DE SALA DE AULA ---

// 0. Listar Salas do Professor
app.get('/classrooms', validateFirebaseIdToken, requireProfessor, async (req, res) => {
    try {
        const snapshot = await db.collection('classrooms')
            .where('ownerId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .get();

        const classrooms = [];
        snapshot.forEach(doc => {
            classrooms.push({ id: doc.id, ...doc.data() });
        });

        res.json(classrooms);
    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    }
});

// 1. Criar Sala
app.post('/classrooms', validateFirebaseIdToken, requireProfessor, async (req, res) => {
    try {
        // Gerar código de sala curto (6 caracteres)
        const generateCode = () => {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sem I, O, 1, 0 para evitar confusão
            let result = "";
            for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
            return result;
        };

        const code = generateCode();
        // TODO: Verificar colisão de código (raro, mas ideal verificar)

        const classroomData = {
            code: code,
            name: req.body.name || `Aula de ${req.userName}`,
            ownerId: req.user.uid,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            currentMusic: null, // Objeto { title, artist, tone, content... }
            participantsCount: 0,
            max_connections: 50 // Default
        };

        // Usar o Código como ID do documento para facilitar busca direta
        await db.collection('classrooms').doc(code).set(classroomData);

        res.json({ success: true, code: code, ...classroomData });

    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
});

// 2. Entrar na Sala (Join)
// Público: Alunos podem não ter conta (Visitantes) ou ter conta (Alunos logados)
// Se for via API, o frontend chama isso para validar se a sala existe e está ativa
app.post('/classrooms/:code/join', async (req, res) => {
    const { code } = req.params;
    const { guestName, userId } = req.body; // userId opcional se for logado

    try {
        const roomRef = db.collection('classrooms').doc(code.toUpperCase());
        const roomDoc = await roomRef.get();

        if (!roomDoc.exists) {
            return res.status(404).json({ message: "Sala não encontrada." });
        }

        const room = roomDoc.data();
        if (room.status !== 'active') {
            return res.status(400).json({ message: "Esta sala já foi encerrada." });
        }

        // Registrar participante
        const participantId = userId || roomRef.collection('participants').doc().id;
        const participantData = {
            name: guestName || 'Anônimo', // Deveria buscar nome do user se userId existir, mas por simplificação
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            type: userId ? 'student' : 'guest',
            isOnline: true,
            userId: userId || null
        };

        // Se for user logado, tentar pegar nome do perfil
        if (userId) {
            const userSnap = await db.collection('users').doc(userId).get();
            if (userSnap.exists) {
                participantData.name = userSnap.data().name || userSnap.data().email || 'Aluno';
            }
        }

        await roomRef.collection('participants').doc(participantId).set(participantData);

        // Incrementar contador (opcional, mas bom ter redundância)
        await roomRef.update({
            participantsCount: admin.firestore.FieldValue.increment(1)
        });

        res.json({
            success: true,
            roomName: room.name,
            ownerId: room.ownerId,
            participantId: participantId
        });

    } catch (error) {
        console.error("Join Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// 3. Encerrar Sala
app.post('/classrooms/:code/close', validateFirebaseIdToken, async (req, res) => {
    const { code } = req.params;
    try {
        const roomRef = db.collection('classrooms').doc(code);
        const roomDoc = await roomRef.get();

        if (!roomDoc.exists) return res.status(404).send('Sala não encontrada');

        // Apenas dono ou admin
        if (roomDoc.data().ownerId !== req.user.uid) { // Todo: check admin
            return res.status(403).send('Sem permissão');
        }

        await roomRef.update({
            status: 'closed',
            closedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });

    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Exportar API
exports.app = functions.https.onRequest(app);
