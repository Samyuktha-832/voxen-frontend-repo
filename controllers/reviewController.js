const pool = require("../config/db");

// Get Reviews
const getReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100; // Increased to show all reviews
    const offset = (page - 1) * limit;

    const reviews = await pool.query(
      `SELECT r.*, u.profile_picture, u.full_name, u.username
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const totalCount = await pool.query("SELECT COUNT(*) FROM reviews");
    const total = parseInt(totalCount.rows[0].count);

    res.json({
      reviews: reviews.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Reviews fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create Review
const createReview = async (req, res) => {
  try {
    const { rating, title, text } = req.body;

    if (!rating || !title || !text) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const userResult = await pool.query(
      "SELECT full_name, username, profile_picture FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];
    const userName = user.full_name || user.username;

    // Check if user already has a review
    const existingReview = await pool.query(
      "SELECT id FROM reviews WHERE user_id = $1",
      [req.user.id]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ 
        error: "You have already submitted a review",
        hasReview: true,
        reviewId: existingReview.rows[0].id
      });
    }

    const newReview = await pool.query(
      `INSERT INTO reviews (user_id, user_name, title, text, rating)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, userName, title, text, rating]
    );

    // Add user data to response
    const reviewWithUser = {
      ...newReview.rows[0],
      profile_picture: user.profile_picture,
      full_name: user.full_name,
      username: user.username
    };

    res.status(201).json({
      message: "Review submitted successfully",
      review: reviewWithUser,
    });
  } catch (error) {
    console.error("Review submission error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Review
const updateReview = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const { rating, title, text } = req.body;

    if (!rating || !title || !text) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const existingReview = await pool.query(
      "SELECT * FROM reviews WHERE id = $1 AND user_id = $2",
      [reviewId, req.user.id]
    );

    if (existingReview.rows.length === 0) {
      return res.status(404).json({ error: "Review not found or unauthorized" });
    }

    const updatedReview = await pool.query(
      `UPDATE reviews 
       SET title = $1, text = $2, rating = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [title, text, rating, reviewId, req.user.id]
    );

    // Get user data
    const userResult = await pool.query(
      "SELECT profile_picture, full_name, username FROM users WHERE id = $1",
      [req.user.id]
    );

    const reviewWithUser = {
      ...updatedReview.rows[0],
      profile_picture: userResult.rows[0].profile_picture,
      full_name: userResult.rows[0].full_name,
      username: userResult.rows[0].username
    };

    res.json({
      message: "Review updated successfully",
      review: reviewWithUser,
    });
  } catch (error) {
    console.error("Review update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete Review
const deleteReview = async (req, res) => {
  try {
    const reviewId = req.params.id;

    const existingReview = await pool.query(
      "SELECT * FROM reviews WHERE id = $1 AND user_id = $2",
      [reviewId, req.user.id]
    );

    if (existingReview.rows.length === 0) {
      return res.status(404).json({ error: "Review not found or unauthorized" });
    }

    await pool.query("DELETE FROM reviews WHERE id = $1 AND user_id = $2", [
      reviewId,
      req.user.id,
    ]);

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Review deletion error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get user's own review
const getUserReview = async (req, res) => {
  try {
    const review = await pool.query(
      `SELECT r.*, u.profile_picture, u.full_name, u.username
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.user_id = $1`,
      [req.user.id]
    );

    if (review.rows.length === 0) {
      return res.json({ hasReview: false, review: null });
    }

    res.json({ hasReview: true, review: review.rows[0] });
  } catch (error) {
    console.error("Get user review error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { 
  getReviews, 
  createReview, 
  updateReview, 
  deleteReview,
  getUserReview 
};