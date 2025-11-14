// config/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("./db"); // ✅ FIXED: Remove destructuring
require("dotenv").config();

// ✅ Validate environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("❌ ERROR: Missing Google OAuth credentials in .env file");
    console.error("   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
    process.exit(1);
}

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5500/api/auth/google/callback",
            // ✅ Add these options for better compatibility
            proxy: true,
            passReqToCallback: false,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log("📥 Google OAuth callback received");
                console.log("👤 Profile ID:", profile.id);
                console.log("📧 Email:", profile.emails?.[0]?.value);

                // ✅ Validate profile data
                if (!profile.id) {
                    console.error("❌ No profile ID received from Google");
                    return done(new Error("Invalid profile data from Google"), null);
                }

                const email = profile.emails?.[0]?.value;
                const fullName = profile.displayName;
                const profilePicture = profile.photos?.[0]?.value;

                if (!email) {
                    console.error("❌ No email received from Google");
                    return done(new Error("Email not provided by Google"), null);
                }

                // Check if user exists
                const userCheck = await pool.query(
                    "SELECT * FROM users WHERE google_id = $1 OR email = $2",
                    [profile.id, email]
                );

                let user;

                if (userCheck.rows.length > 0) {
                    // User exists - update their info
                    user = userCheck.rows[0];
                    console.log("✅ Existing user found:", user.id);

                    // Update user info in case it changed
                    await pool.query(
                        `UPDATE users 
                         SET full_name = $1, 
                             profile_picture = $2, 
                             google_id = $3,
                             updated_at = NOW()
                         WHERE id = $4`,
                        [fullName, profilePicture, profile.id, user.id]
                    );

                    console.log("✅ User info updated");
                } else {
                    // Create new user
                    console.log("🆕 Creating new user...");

                    const result = await pool.query(
                        `INSERT INTO users (full_name, email, google_id, profile_picture, username, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                         RETURNING *`,
                        [
                            fullName,
                            email,
                            profile.id,
                            profilePicture,
                            email.split("@")[0], // Use part before @ as username
                        ]
                    );

                    user = result.rows[0];
                    console.log("✅ New user created:", user.id);
                }

                // Return user object
                return done(null, user);
            } catch (error) {
                console.error("❌ OAuth Strategy Error:", error);
                console.error("Stack:", error.stack);
                return done(error, null);
            }
        }
    )
);

// Serialize user
passport.serializeUser((user, done) => {
    console.log("🔐 Serializing user:", user.id);
    done(null, user.id);
});

// Deserialize user
passport.deserializeUser(async (id, done) => {
    try {
        console.log("🔓 Deserializing user:", id);
        const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        
        if (result.rows.length === 0) {
            console.error("❌ User not found during deserialization:", id);
            return done(new Error("User not found"), null);
        }
        
        console.log("✅ User deserialized:", result.rows[0].id);
        done(null, result.rows[0]);
    } catch (error) {
        console.error("❌ Deserialization error:", error);
        done(error, null);
    }
});

module.exports = passport;