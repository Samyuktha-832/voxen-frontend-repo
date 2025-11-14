// routes/pages.js
const express = require("express");
const path = require("path");
const router = express.Router();

// Landing page (login/signup)
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Home page (after login)
router.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/home.html"));
});

// Chat page
router.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/chat.html"));
});

// About page
router.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/about.html"));
});

module.exports = router;
