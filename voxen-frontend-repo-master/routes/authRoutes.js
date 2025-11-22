const express = require("express");
const { registerUser, loginUser, logoutUser, googleCallback } = require("../controllers/authController");
const passport = require("passport");
const {authenticateToken} = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);

// ✅ Protected route for profile
router.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: "Profile fetched successfully",
    user: req.user, // comes from JWT payload
  });
});

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/?error=google_auth_failed" }),
  googleCallback
);

module.exports = router;
