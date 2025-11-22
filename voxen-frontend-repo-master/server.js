// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();

// Custom middleware and config
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
require("./config/db");          // Database connection
require("./config/passport");    // Passport configuration

// Route imports
const apiRoutes = require("./routes/index");   // All /api routes
const pageRoutes = require("./routes/pages");  // Frontend page routes

const app = express();

// ---------------------
// 🔧 Middleware setup
// ---------------------
app.use(cors({
  origin: ["http://localhost:5000", "http://localhost:5500"],
  credentials: true,
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Session MUST be before passport
app.use(session({
  secret: process.env.SESSION_SECRET || "your-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ---------------------
// 🚀 Routes
// ---------------------

// Frontend Pages (static HTML)
app.use("/", pageRoutes);

// Backend APIs (JSON)
app.use("/api", apiRoutes);

// ---------------------
// ⚠️ Error Handlers
// ---------------------
app.use(notFound);
app.use(errorHandler);

// ---------------------
// 🌍 Start the server
// ---------------------
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`API routes at: http://localhost:${PORT}/api`);
  console.log(`\n📝 Environment Check:`);
  console.log(`   - GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅' : '❌ MISSING'}`);
  console.log(`   - GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅' : '❌ MISSING'}`);
  console.log(`   - JWT_SECRET: ${process.env.JWT_SECRET ? '✅' : '❌ MISSING'}`);
  console.log(`   - SESSION_SECRET: ${process.env.SESSION_SECRET ? '✅' : '❌ MISSING'}`);
  console.log(`   - DB_NAME: ${process.env.DB_NAME || 'astro_auth'}`);
  console.log(`\n🔗 OAuth Callback URL: http://localhost:${PORT}/api/auth/google/callback`);
  console.log(`   Make sure this matches in Google Console!\n`);
});