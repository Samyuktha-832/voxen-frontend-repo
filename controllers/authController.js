// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Manual Registration
const registerUser = async (req, res) => {
  try {
    const { fullName, email, username, password } = req.body;

    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      if (existing.email === email) {
        return res.status(400).json({ error: "Email already registered" });
      }
      if (existing.username === username) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await pool.query(
      `INSERT INTO users (full_name, email, username, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, username, created_at`,
      [fullName, email, username, passwordHash]
    );

    const token = jwt.sign(
      {
        id: newUser.rows[0].id,
        email: newUser.rows[0].email,
        username: newUser.rows[0].username,
      },
      process.env.JWT_SECRET || "your-jwt-secret",
      { expiresIn: "24h" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: newUser.rows[0],
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Manual Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const foundUser = user.rows[0];

    if (!foundUser.password_hash) {
      return res.status(401).json({ error: "Please sign in with Google" });
    }

    const isValidPassword = await bcrypt.compare(password, foundUser.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: foundUser.id,
        email: foundUser.email,
        username: foundUser.username,
      },
      process.env.JWT_SECRET || "your-jwt-secret",
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      user: {
        id: foundUser.id,
        full_name: foundUser.full_name,
        email: foundUser.email,
        username: foundUser.username,
        profile_picture: foundUser.profile_picture,
        created_at: foundUser.created_at,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Google Callback - REDIRECT TO HOME
const googleCallback = async (req, res) => {
  try {
    // Check if user exists in request
    if (!req.user) {
      console.error("❌ No user in request after Google OAuth");
      return res.redirect("/?error=auth_failed");
    }

    console.log("✅ Google OAuth user:", req.user);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
      },
      process.env.JWT_SECRET || "your-jwt-secret",
      { expiresIn: "24h" }
    );

    // Prepare user data
    const userData = {
      id: req.user.id,
      full_name: req.user.full_name || req.user.username,
      email: req.user.email,
      username: req.user.username,
      profile_picture: req.user.profile_picture || "",
    };

    console.log("✅ Redirecting with user data:", userData);

    // Redirect to HOME page (changed from /chat)
    res.redirect(
      `/home?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`
    );
  } catch (error) {
    console.error("❌ Google callback error:", error);
    console.error("Error stack:", error.stack);
    res.redirect("/?error=auth_callback_failed");
  }
};

// Logout
const logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ message: "Logout successful" });
  });
};

module.exports = { registerUser, loginUser, googleCallback, logoutUser };