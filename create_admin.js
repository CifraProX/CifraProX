const db = require('./backend/db');

async function createAdmin() {
    console.log('Criando usuário admin...');
    try {
        // Primeiro, verificar se já existe para evitar erro de duplicidade ou atualizar
        const check = await db.query('SELECT * FROM users WHERE email = $1', ['cifraprox@gmail.com']);

        if (check.rows.length > 0) {
            console.log('Usuário já existe. Atualizando para ADMIN...');
            await db.query(`
                UPDATE users 
                SET role = 'admin', status = 'active', password_hash = $1, plan_id = 4 
                WHERE email = $2`,
                ['projetoinfcifras', 'cifraprox@gmail.com']
            );
            console.log('Usuário atualizado com sucesso.');
        } else {
            const res = await db.query(
                `INSERT INTO users (name, email, password_hash, role, status, plan_id, instrument)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, email`,
                ['Admin CifraProX', 'cifraprox@gmail.com', 'projetoinfcifras', 'admin', 'active', 4, 'Violão']
            );
            console.log('Usuário criado com sucesso:', res.rows[0]);
        }
    } catch (err) {
        console.error('Erro ao criar admin:', err);
    } finally {
        process.exit();
    }
}

createAdmin();
