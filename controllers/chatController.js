// chatController.js
const pool = require('../config/db');
const dotenv = require("dotenv");
const fetch = require('node-fetch'); // ✅ Make sure to install: npm install node-fetch@2
dotenv.config();

// Default fallback model (only used if frontend sends nothing)
const DEFAULT_MODEL = "qwen2.5:0.5b";

// ✅ Ollama configuration for embeddings
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'nomic-embed-text:latest';

console.log('🔍 Pool object:', pool);
console.log('🔍 Pool.query type:', typeof pool.query);
console.log('🤖 Embedding Model:', EMBEDDING_MODEL);
console.log('🔗 Ollama URL:', OLLAMA_BASE_URL);

/* ==========================================
   EMBEDDING HELPER FUNCTIONS
========================================== */

// Generate embedding using Ollama
async function generateEmbedding(text) {
  try {
    if (!text || text.trim().length < 3) {
      console.log('⏭️ Text too short for embedding');
      return null;
    }

    console.log(`🔄 Generating embedding via Ollama...`);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text
      }),
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.embedding) {
      throw new Error('No embedding returned from Ollama');
    }

    console.log(`✅ Embedding generated (dimension: ${data.embedding.length})`);
    return data.embedding;

  } catch (error) {
    console.error('❌ Embedding generation failed:', error.message);
    return null;
  }
}

// Store embedding in database
async function storeEmbedding(messageId, embedding) {
  try {
    const embeddingStr = JSON.stringify(embedding);
    
    await pool.query(
      `INSERT INTO embeddings (message_id, embedding_vector, model_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (message_id) 
       DO UPDATE SET 
         embedding_vector = EXCLUDED.embedding_vector,
         model_name = EXCLUDED.model_name,
         updated_at = NOW()`,
      [messageId, embeddingStr, EMBEDDING_MODEL]
    );
    
    console.log(`✅ Embedding stored for message ${messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to store embedding for message ${messageId}:`, error.message);
    return false;
  }
}

// Generate and store embedding (async, non-blocking)
async function generateAndStoreEmbedding(messageId, content) {
  try {
    if (!content || content.trim().length < 3) {
      console.log(`⏭️ Skipping embedding for message ${messageId} (content too short)`);
      return;
    }

    console.log(`🔄 Generating embedding for message ${messageId}...`);
    const embedding = await generateEmbedding(content);
    
    if (embedding) {
      await storeEmbedding(messageId, embedding);
    }
  } catch (error) {
    console.error(`❌ Error in generateAndStoreEmbedding for message ${messageId}:`, error.message);
  }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/* ==========================================
   Create Conversation
========================================== */
exports.createConversation = async (req, res) => {
  try {
    const { user_id, title, model_used, model_name } = req.body;

    const model = model_used || model_name || DEFAULT_MODEL;

    const result = await pool.query(
      `INSERT INTO conversations (user_id, title, model_used)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, title || "New Chat", model]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
};

/* ==========================================
   Create Message
========================================== */
exports.createMessage = async (req, res) => {
  try {
    const { conversation_id, sender, content, model_used, model_name } = req.body;

    console.log('📥 createMessage received:', { conversation_id, sender, model_used, model_name });

    const convo = await pool.query(
      `SELECT model_used FROM conversations WHERE id = $1`,
      [conversation_id]
    );

    let model = model_used || model_name;

    if (!model && convo.rows.length && convo.rows[0].model_used) {
      model = convo.rows[0].model_used;
    }

    model = model || DEFAULT_MODEL;

    console.log('✅ Using model:', model);

    await pool.query(
      `UPDATE conversations
       SET model_used = COALESCE(model_used, $1), updated_at = NOW()
       WHERE id = $2`,
      [model, conversation_id]
    );

    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content, model_used)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [conversation_id, sender, content, model]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
};

/* ==========================================
   Save Chat Messages (User + AI) - WITH EMBEDDINGS
========================================== */
exports.saveChatMessages = async (req, res) => {
  try {
    const { userMessage, aiMessage, conversationId, userId, model_used, model_name } = req.body;

    console.log('💾 saveChatMessages received:', { 
      conversationId, 
      userId, 
      model_used, 
      model_name,
      hasUserMessage: !!userMessage,
      hasAiMessage: !!aiMessage
    });

    // Validate user exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ 
        error: 'User not found',
        message: `User with ID ${userId} does not exist. Please log in again.`,
        userId: userId
      });
    }

    let currentConversationId = conversationId;
    const modelToUse = model_used || model_name || DEFAULT_MODEL;

    console.log('🎯 Model to use:', modelToUse);

    // Create or update conversation
    if (!currentConversationId) {
      const title = userMessage.substring(0, 50) || "New Chat";
      console.log('🆕 Creating new conversation with model:', modelToUse);

      const convResult = await pool.query(
        `INSERT INTO conversations (user_id, title, model_used)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, title, modelToUse]
      );

      currentConversationId = convResult.rows[0].id;
      console.log('✅ New conversation created:', currentConversationId);
    } else {
      // Validate conversation belongs to user
      const convCheck = await pool.query(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [currentConversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        console.error('❌ Conversation not found or access denied:', currentConversationId);
        return res.status(403).json({ 
          error: 'Conversation not found or access denied',
          conversationId: currentConversationId,
          userId: userId
        });
      }

      console.log('🔄 Updating conversation', currentConversationId, 'with model:', modelToUse);
      await pool.query(
        `UPDATE conversations 
         SET model_used = $1, updated_at = NOW()
         WHERE id = $2`,
        [modelToUse, currentConversationId]
      );
    }

    // Save user message
    const userResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content, model_used)
       VALUES ($1, $2, $3, $4)
       RETURNING id, model_used`,
      [currentConversationId, "user", userMessage, modelToUse]
    );

    const userMessageId = userResult.rows[0].id;
    console.log('✅ User message saved:', userMessageId);

    // Save AI message
    const aiResult = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content, model_used)
       VALUES ($1, $2, $3, $4)
       RETURNING id, model_used`,
      [currentConversationId, "ai", aiMessage, modelToUse]
    );

    const aiMessageId = aiResult.rows[0].id;
    console.log('✅ AI message saved:', aiMessageId);

    // Update conversation stats
    await pool.query(
      `UPDATE conversations 
       SET updated_at = NOW(), message_count = message_count + 2
       WHERE id = $1`,
      [currentConversationId]
    );

    // ✅ Generate embeddings asynchronously (don't wait for completion)
    console.log('🔄 Starting embedding generation...');
    generateAndStoreEmbedding(userMessageId, userMessage).catch(err => 
      console.warn('⚠️ User message embedding failed:', err.message)
    );
    
    generateAndStoreEmbedding(aiMessageId, aiMessage).catch(err => 
      console.warn('⚠️ AI message embedding failed:', err.message)
    );

    res.status(200).json({
      success: true,
      conversationId: currentConversationId,
      message: "Messages saved successfully",
      modelUsed: modelToUse,
      embeddingStatus: 'generating' // Indicates embeddings are being generated
    });

  } catch (error) {
    console.error("❌ Error saving messages:", error);
    
    if (error.code === '23503') {
      return res.status(404).json({ 
        error: "User not found",
        message: "The user account does not exist. Please log in again.",
        details: error.detail
      });
    }
    
    res.status(500).json({ 
      error: "Failed to save messages",
      details: error.message 
    });
  }
};

/* ==========================================
   Get Conversations
========================================== */
exports.getConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT id, user_id, title, model_used, created_at, updated_at, message_count, is_pinned
       FROM conversations
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    
    res.json({ conversations: result.rows });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

/* ==========================================
   Get Messages
========================================== */
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;
    
    const result = await pool.query(
      `SELECT m.id, m.conversation_id, m.sender, m.content, m.model_used, m.created_at,
              c.title as conversation_title
       FROM messages m
       LEFT JOIN conversations c ON m.conversation_id = c.id
       WHERE m.conversation_id = $1 AND c.user_id = $2
       ORDER BY m.created_at ASC`,
      [conversationId, userId]
    );
    
    res.json({ messages: result.rows });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

/* ==========================================
   Delete Conversation
========================================== */
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    // Delete embeddings first (cascade will handle this, but being explicit)
    await pool.query(
      `DELETE FROM embeddings WHERE message_id IN 
       (SELECT id FROM messages WHERE conversation_id = $1)`,
      [conversationId]
    );

    await pool.query(
      `DELETE FROM messages WHERE conversation_id = $1`,
      [conversationId]
    );

    await pool.query(
      `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    res.json({ success: true, message: "Conversation deleted" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};

/* ==========================================
   Update Conversation Title
========================================== */
exports.updateConversationTitle = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title, userId } = req.body;

    const result = await pool.query(
      `UPDATE conversations 
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [title, conversationId, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating title:", error);
    res.status(500).json({ error: "Failed to update title" });
  }
};

/* ==========================================
   Update Conversation Model
========================================== */
exports.updateConversationModel = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { model, userId } = req.body;

    const result = await pool.query(
      `UPDATE conversations 
       SET model_used = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [model, conversationId, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating model:", error);
    res.status(500).json({ error: "Failed to update model" });
  }
};

/* ==========================================
   Toggle Pin Conversation
========================================== */
exports.togglePinConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    const result = await pool.query(
      `UPDATE conversations 
       SET is_pinned = NOT is_pinned, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [conversationId, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error toggling pin:", error);
    res.status(500).json({ error: "Failed to toggle pin" });
  }
};

/* ==========================================
   Search Messages - WITH SEMANTIC SEARCH
========================================== */
exports.searchMessages = async (req, res) => {
  try {
    const { userId, query } = req.body;

    if (!query || query.trim().length < 3) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    console.log(`🔍 Searching for: "${query}" (user: ${userId})`);

    // Generate embedding for the search query
    console.log('🔄 Generating query embedding...');
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.warn('⚠️ Could not generate query embedding, falling back to keyword search');
      return performKeywordSearch(userId, query, res);
    }

    console.log('✅ Query embedding generated');

    // Get all messages with embeddings for this user
    const result = await pool.query(
      `SELECT 
        m.id, m.conversation_id, m.sender as role, m.content, m.created_at,
        c.title as conversation_title,
        e.embedding_vector
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       JOIN embeddings e ON m.id = e.message_id
       WHERE c.user_id = $1
       ORDER BY m.created_at DESC`,
      [userId]
    );

    console.log(`📊 Found ${result.rows.length} messages with embeddings`);

    if (result.rows.length === 0) {
      console.log('⚠️ No embeddings found, falling back to keyword search');
      return performKeywordSearch(userId, query, res);
    }

    // Calculate similarity for each message
    const messagesWithScores = result.rows.map(row => {
      try {
        const messageEmbedding = JSON.parse(row.embedding_vector);
        const similarity = cosineSimilarity(queryEmbedding, messageEmbedding);
        
        return {
          id: row.id,
          conversationId: row.conversation_id,
          role: row.role,
          content: row.content,
          createdAt: row.created_at,
          conversationTitle: row.conversation_title,
          similarity: similarity
        };
      } catch (error) {
        console.error(`Error parsing embedding for message ${row.id}:`, error.message);
        return null;
      }
    }).filter(msg => msg !== null);

    // Sort by similarity and filter by threshold
    const SIMILARITY_THRESHOLD = 0.3;
    const relevantMessages = messagesWithScores
      .filter(msg => msg.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 50);

    console.log(`✅ Found ${relevantMessages.length} relevant messages (threshold: ${SIMILARITY_THRESHOLD})`);

    if (relevantMessages.length === 0) {
      console.log('⚠️ No relevant messages found, trying keyword search');
      return performKeywordSearch(userId, query, res);
    }

    // Group by conversation
    const conversations = {};
    relevantMessages.forEach(msg => {
      if (!conversations[msg.conversationId]) {
        conversations[msg.conversationId] = {
          conversationId: msg.conversationId,
          conversationTitle: msg.conversationTitle,
          messages: []
        };
      }
      conversations[msg.conversationId].messages.push({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
        similarity: msg.similarity
      });
    });

    res.json({
      conversations: Object.values(conversations),
      totalMessages: relevantMessages.length,
      searchType: 'semantic',
      embeddingModel: EMBEDDING_MODEL
    });

  } catch (error) {
    console.error("❌ Error in semantic search:", error);
    res.status(500).json({ error: "Failed to search messages" });
  }
};

// Fallback keyword search function
async function performKeywordSearch(userId, query, res) {
  try {
    console.log('🔍 Performing keyword search...');
    
    const result = await pool.query(
      `SELECT 
        m.id, m.conversation_id, m.sender as role, m.content, m.created_at,
        c.title as conversation_title,
        0.5 as similarity
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND m.content ILIKE $2
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [userId, `%${query}%`]
    );

    const conversations = {};
    result.rows.forEach(row => {
      if (!conversations[row.conversation_id]) {
        conversations[row.conversation_id] = {
          conversationId: row.conversation_id,
          conversationTitle: row.conversation_title,
          messages: []
        };
      }
      conversations[row.conversation_id].messages.push({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        createdAt: row.created_at,
        similarity: row.similarity || 0
      });
    });

    console.log(`✅ Keyword search found ${result.rows.length} messages`);

    res.json({
      conversations: Object.values(conversations),
      totalMessages: result.rows.length,
      searchType: 'keyword'
    });
  } catch (error) {
    console.error("❌ Keyword search error:", error);
    res.status(500).json({ error: "Failed to search messages" });
  }
}

/* ==========================================
   Get Conversation Stats
========================================== */
exports.getConversationStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await pool.query(
      `SELECT 
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(m.id) as total_messages,
        COUNT(DISTINCT DATE(c.created_at)) as active_days
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1`,
      [userId]
    );

    res.json(stats.rows[0]);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

/* ==========================================
   Generate Missing Embeddings
========================================== */
exports.generateMissingEmbeddings = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`🔄 Generating missing embeddings for user ${userId} (limit: ${limit})`);
    
    // Get messages without embeddings
    const result = await pool.query(
      `SELECT m.id, m.content 
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       LEFT JOIN embeddings e ON m.id = e.message_id
       WHERE c.user_id = $1 AND e.id IS NULL AND LENGTH(TRIM(m.content)) >= 3
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    console.log(`📊 Found ${result.rows.length} messages without embeddings`);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'All messages already have embeddings',
        totalProcessed: 0,
        successCount: 0,
        failCount: 0
      });
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const row of result.rows) {
      try {
        await generateAndStoreEmbedding(row.id, row.content);
        successCount++;
      } catch (error) {
        console.error(`Failed for message ${row.id}:`, error.message);
        failCount++;
        errors.push({ messageId: row.id, error: error.message });
      }
    }

    console.log(`✅ Embedding generation complete: ${successCount}/${result.rows.length} successful`);

    res.json({
      success: true,
      totalProcessed: result.rows.length,
      successCount,
      failCount,
      embeddingModel: EMBEDDING_MODEL,
      errors: errors.slice(0, 5) // Return first 5 errors
    });

  } catch (error) {
    console.error("Error generating embeddings:", error);
    res.status(500).json({ error: "Failed to generate embeddings" });
  }
};

/* ==========================================
   Get Embedding Statistics
========================================== */
exports.getEmbeddingStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await pool.query(
      `SELECT 
        COUNT(DISTINCT m.id) as total_messages,
        COUNT(DISTINCT e.id) as messages_with_embeddings,
        COALESCE(COUNT(DISTINCT e.id) * 100.0 / NULLIF(COUNT(DISTINCT m.id), 0), 0) as coverage_percentage
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       LEFT JOIN embeddings e ON m.id = e.message_id
       WHERE c.user_id = $1`,
      [userId]
    );

    const modelStats = await pool.query(
      `SELECT e.model_name, COUNT(*) as count
       FROM embeddings e
       JOIN messages m ON e.message_id = m.id
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1
       GROUP BY e.model_name`,
      [userId]
    );

    res.json({
      total_messages: parseInt(stats.rows[0].total_messages),
      messages_with_embeddings: parseInt(stats.rows[0].messages_with_embeddings),
      messages_without_embeddings: parseInt(stats.rows[0].total_messages) - parseInt(stats.rows[0].messages_with_embeddings),
      coverage_percentage: parseFloat(stats.rows[0].coverage_percentage).toFixed(2),
      models: modelStats.rows,
      current_model: EMBEDDING_MODEL
    });

  } catch (error) {
    console.error("Error fetching embedding stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

/* ==========================================
   Get Chat Response (Placeholder)
========================================== */
exports.getChatResponse = async (req, res) => {
  try {
    res.status(501).json({ 
      error: "This endpoint should be called on your AI server (port 8000)" 
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/* ==========================================
   Test Database Connection
========================================== */
exports.testDatabaseConnection = async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: "Database connected",
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error("Database test failed:", error);
    res.status(500).json({ 
      success: false, 
      error: "Database connection failed" 
    });
  }
};