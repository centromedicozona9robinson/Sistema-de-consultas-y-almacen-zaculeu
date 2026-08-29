require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port:     parseInt(process.env.DB_PORT || '5432'),
    ssl:      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    connectionTimeoutMillis: 10000,
    ...(process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {}),
});

pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
});

module.exports = pool;
