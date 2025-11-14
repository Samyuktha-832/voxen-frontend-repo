const pool = require("../config/db");
const fs = require("fs");
const path = require("path");

const getProfile = async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id, full_name, email, username, profile_picture, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: user.rows[0] });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const profilePicturePath = `/uploads/profile-pictures/${req.file.filename}`;

    // Get current profile picture to delete old one
    const currentUser = await pool.query(
      "SELECT profile_picture FROM users WHERE id = $1",
      [req.user.id]
    );

    // Update database with new profile picture path
    const updatedUser = await pool.query(
      "UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING id, full_name, email, username, profile_picture, created_at",
      [profilePicturePath, req.user.id]
    );

    // Delete old profile picture if it exists
    if (currentUser.rows[0]?.profile_picture) {
      const oldFilePath = path.join(__dirname, "..", currentUser.rows[0].profile_picture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({
      message: "Profile picture uploaded successfully",
      user: updatedUser.rows[0],
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteProfilePicture = async (req, res) => {
  try {
    // Get current profile picture
    const currentUser = await pool.query(
      "SELECT profile_picture FROM users WHERE id = $1",
      [req.user.id]
    );

    if (!currentUser.rows[0]?.profile_picture) {
      return res.status(404).json({ error: "No profile picture to delete" });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, "..", currentUser.rows[0].profile_picture);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update database to remove profile picture
    const updatedUser = await pool.query(
      "UPDATE users SET profile_picture = NULL WHERE id = $1 RETURNING id, full_name, email, username, profile_picture, created_at",
      [req.user.id]
    );

    res.json({
      message: "Profile picture deleted successfully",
      user: updatedUser.rows[0],
    });
  } catch (error) {
    console.error("Profile picture delete error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getProfile, uploadProfilePicture, deleteProfilePicture };
