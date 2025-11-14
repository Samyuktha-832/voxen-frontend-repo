// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// ✅ Create pool with error handling
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'astro_auth',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// ✅ Handle pool errors
pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

// ✅ Test connection immediately
(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        const result = await client.query('SELECT NOW()');
        console.log('⏰ Database time:', result.rows[0].now);
        client.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('📋 Connection config:', {
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'astro_auth',
            user: process.env.DB_USER || 'postgres',
            port: process.env.DB_PORT || 5432
        });
    }
})();

const createTables = async () => {
    try {
        // Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                profile_picture VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created/verified');

        // Reviews table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                user_name VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                text TEXT NOT NULL,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Reviews table created/verified');

        // Conversations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) DEFAULT 'New Chat',
                model_used VARCHAR(100) DEFAULT 'qwen2.5:0.5b',
                summary TEXT,
                message_count INTEGER DEFAULT 0,
                is_pinned BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Conversations table created/verified');

        // Messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                sender VARCHAR(20) CHECK (sender IN ('user', 'ai')) NOT NULL,
                content TEXT NOT NULL,
                model_used VARCHAR(100),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Messages table created/verified');

        // Embeddings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS embeddings (
                id SERIAL PRIMARY KEY,
                message_id INTEGER UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
                embedding_vector TEXT NOT NULL,
                model_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Embeddings table created/verified');

        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_embeddings_message 
            ON embeddings(message_id)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_conversation 
            ON messages(conversation_id, created_at DESC)
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_conversations_user 
            ON conversations(user_id, updated_at DESC)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_conversations_model_used 
            ON conversations(model_used)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_model_used 
            ON messages(model_used)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_embeddings_model_name 
            ON embeddings(model_name)
        `);

        console.log('✅ Performance indexes created');
        console.log('✅ All tables created successfully');

    } catch (err) {
        console.error('❌ Error creating database tables:', err);
        throw err;
    }
};

// Initialize database tables
createTables().catch(err => {
    console.error('Failed to initialize database:', err);
});

// ✅ IMPORTANT: Export the pool instance
module.exports = pool;