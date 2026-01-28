const db = require('./backend/db');

async function fixPlanNames() {
    try {
        console.log('Iniciando correção de encoding dos planos...');

        // 1. Check current plans
        const check = await db.query('SELECT * FROM plans');
        console.table(check.rows);

        // 2. Update strict mapping (based on known issues)
        // Fixing "Escola BÃ¡sico" -> "Escola Básico"
        // Fixing "Aluno (GrÃ¡tis)" -> "Aluno (Grátis)"
        // And generally forcing correct UTF-8 strings for all IDs we know.

        const updates = [
            { id: 1, name: 'Aluno (Grátis)' },
            { id: 4, name: 'Escola Básico' }
        ];

        for (const u of updates) {
            await db.query('UPDATE plans SET name = $1 WHERE id = $2', [u.name, u.id]);
            console.log(`Updated Plan ID ${u.id} to "${u.name}"`);
        }

        console.log('Correção concluída!');
        process.exit(0);

    } catch (e) {
        console.error('Erro:', e);
        process.exit(1);
    }
}

fixPlanNames();
