const express = require("express");
const router = express.Router();

// Import other route files
const userRoutes = require("./userRoutes");
const authRoutes = require("./authRoutes");
const chatRoutes = require("./chatRoutes");
const reviewRoutes = require("./reviewRoutes");

// Use them with prefixes
router.use("/user", userRoutes);
router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/reviews", reviewRoutes);

module.exports = router;
