const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'cifrasprox',
    password: 'postgres', // Senha descoberta em pw.txt
    port: 5432,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
