const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { getReviews, createReview, updateReview, deleteReview } = require("../controllers/reviewController");

const router = express.Router();

router.get("/", getReviews);
router.post("/", authenticateToken, createReview);
router.put("/:id", authenticateToken, updateReview);
router.delete("/:id", authenticateToken, deleteReview);

module.exports = router;
