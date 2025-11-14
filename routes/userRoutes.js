const express = require("express");
const multer = require("multer");
const path = require("path");
const { authenticateToken } = require("../middleware/authMiddleware");
const { getProfile, uploadProfilePicture, deleteProfilePicture } = require("../controllers/userController");

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profile-pictures/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Debug logging
router.use((req, res, next) => {
  console.log(`🔍 User Route: ${req.method} ${req.path}`);
  next();
});

router.get("/profile", authenticateToken, getProfile);
router.post("/profile/picture", authenticateToken, upload.single("profilePicture"), uploadProfilePicture);
router.delete("/profile/picture", authenticateToken, deleteProfilePicture);

module.exports = router;
