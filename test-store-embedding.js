// test-store-embedding.js
const { Pool } = require('pg');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function testStoreEmbedding() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'voxen',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });

  const client = await pool.connect();
  try {
    console.log("🚀 Starting embedding storage test...");
    await client.query('BEGIN');

    // 1. Create or get test user
    console.log("1. Ensuring test user exists...");
    const userRes = await client.query(`
      INSERT INTO users (
        username, 
        email, 
        password_hash, 
        created_at, 
        updated_at
      )
      VALUES (
        'testuser', 
        'test@example.com', 
        'dummyhash', 
        NOW(), 
        NOW()
      )
      ON CONFLICT (username) 
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `);
    const userId = userRes.rows[0].id;
    console.log(`   ✅ Using user ID: ${userId}`);

    // 2. Create conversation
    console.log("\n2. Creating test conversation...");
    const convRes = await client.query(`
      INSERT INTO conversations (
        user_id, 
        title, 
        created_at, 
        updated_at
      )
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id
    `, [userId, `Test Conversation ${new Date().toISOString()}`]);
    const conversationId = convRes.rows[0].id;
    console.log(`   ✅ Created conversation ID: ${conversationId}`);

    // 3. Create message
    console.log("\n3. Creating test message...");
    // 3. Create message
console.log("\n3. Creating test message...");
const messageRes = await client.query(`
  INSERT INTO messages (
    conversation_id, 
    sender, 
    content
  )
  VALUES ($1, $2, $3)
  RETURNING id
`, [conversationId, 'user', 'Test message for embedding']);
const messageId = messageRes.rows[0].id;
console.log(`   ✅ Created message ID: ${messageId}`);

    // 4. Generate embedding
    console.log("\n4. Generating embedding...");
    const embeddingResponse = await axios.post('http://localhost:11434/api/embeddings', {
      model: "nomic-embed-text",
      prompt: "test message for embedding"
    });
    const embedding = embeddingResponse.data.embedding;
    console.log(`   ✅ Generated embedding (${embedding.length} dimensions)`);

    // 5. Store embedding
    console.log("\n5. Storing embedding...");
    const storeResult = await client.query(`
      INSERT INTO embeddings (
        message_id, 
        embedding_vector, 
        created_at, 
        updated_at
      )
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id, message_id, created_at
    `, [messageId, JSON.stringify(embedding)]);
    console.log(`   ✅ Stored embedding ID: ${storeResult.rows[0].id}`);

    // 6. Verify everything
    console.log("\n6. Verifying data...");
    const verifyResult = await client.query(`
      SELECT 
        e.id as embedding_id,
        m.id as message_id,
        m.content,
        c.id as conversation_id,
        c.title as conversation_title,
        u.id as user_id,
        u.username,
        LENGTH(e.embedding_vector::text) as vector_size
      FROM embeddings e
      JOIN messages m ON e.message_id = m.id
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE e.id = $1
    `, [storeResult.rows[0].id]);
    
    console.log("\n📊 Verification successful:");
    console.table(verifyResult.rows[0]);

    await client.query('ROLLBACK');
    console.log("\n🧹 Test completed (rolled back)");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testStoreEmbedding()
  .then(() => console.log("\n✨ All tests completed successfully!"))
  .catch(() => process.exit(1));