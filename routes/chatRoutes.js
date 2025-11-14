// routes/chatRoutes.js
const express = require("express");
const router = express.Router();

const chatController = require("../controllers/chatController");

const { 
  getChatResponse, 
  getConversations, 
  getMessages, 
  createConversation, 
  deleteConversation,
  updateConversationTitle,
  updateConversationModel,
  togglePinConversation,
  searchMessages,
  getConversationStats,
  saveChatMessages,
  testDatabaseConnection,
  generateMissingEmbeddings,  // ✅ NEW
  getEmbeddingStats            // ✅ NEW
} = chatController;

// ============================================
// CHAT ENDPOINTS
// ============================================

router.post("/", getChatResponse);
router.post("/save", saveChatMessages);
router.post("/search", searchMessages);

// ============================================
// CONVERSATION ENDPOINTS
// ============================================

router.get("/conversations/:userId", getConversations);
router.post("/conversations", createConversation);
router.delete("/conversations/:conversationId", deleteConversation);
router.patch("/conversations/:conversationId/title", updateConversationTitle);
router.patch("/conversations/:conversationId/pin", togglePinConversation);
router.patch("/conversations/:conversationId/model", updateConversationModel);

router.get("/stats/:userId", getConversationStats);

// ============================================
// MESSAGE ENDPOINTS
// ============================================

router.get("/messages/:conversationId", getMessages);

// ============================================
// EMBEDDING ENDPOINTS (NEW)
// ============================================

// Generate embeddings for messages without them
router.post("/embeddings/generate/:userId", generateMissingEmbeddings);

// Get embedding statistics for a user
router.get("/embeddings/stats/:userId", getEmbeddingStats);

// ============================================
// TESTING ENDPOINTS
// ============================================

router.get("/test-db", testDatabaseConnection);

module.exports = router;