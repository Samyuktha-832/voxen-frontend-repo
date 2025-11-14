# Voxen - AI Voice Agent Platform

An intelligent, conversational AI assistant designed to interact naturally with users, understand their needs in real time, and provide quick, accurate, and personalized responses — making communication seamless and efficient.

## Features

- User Authentication with JWT tokens
- Google OAuth Integration
- User Dashboard with personalized content
- AI Chat Interface
- Review System for user testimonials
- Responsive Design with cosmic-themed UI
- PostgreSQL Database with multiple tables

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14 or higher) - https://nodejs.org/
- PostgreSQL (v12 or higher) - https://www.postgresql.org/download/
- npm (comes with Node.js)
- Git (for cloning the repository)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/shrutissajeev-boop/voxen.git
cd voxen
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages:
- express - Web framework
- pg - PostgreSQL client
- bcryptjs - Password hashing
- jsonwebtoken - JWT authentication
- passport & passport-google-oauth20 - Google OAuth
- express-session - Session management
- cors - Cross-origin resource sharing
- dotenv - Environment variable management
- ejs - Template engine
- openai - OpenAI API integration

### 3. Set Up PostgreSQL Database

Create a database:
```sql
CREATE DATABASE astro_auth;
```

The application will automatically create the required tables on startup:
- users - User accounts and profiles
- reviews - User testimonials
- conversations - Chat sessions
- messages - Chat messages

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5500

# Database Configuration
DB_USER=postgres
DB_HOST=localhost
DB_NAME=astro_auth
DB_PASSWORD=your_postgres_password
DB_PORT=5432

# JWT Secret (use a strong random string)
JWT_SECRET=your_jwt_secret_key_here

# Session Secret (use a strong random string)
SESSION_SECRET=your_session_secret_key_here

# Google OAuth Credentials (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5500/api/auth/google/callback

# OpenAI API Key (for AI chat functionality)
OPENAI_API_KEY=your_openai_api_key
```

**Important:** Replace the placeholder values with your actual credentials.

## Running the Application

### Start the Server

```bash
npm start
```

Or directly with Node:

```bash
node server.js
```

The server will start on http://localhost:5500

You should see:
```
✅ Server running on http://localhost:5500
API routes at: http://localhost:5500/api
✅ Users table created/verified
✅ Reviews table created/verified
✅ Conversations table created/verified
✅ Messages table created/verified
✅ All core tables created successfully
```

### Access the Application

- Landing Page (Login/Signup): http://localhost:5500/
- Home Dashboard: http://localhost:5500/home (after login)
- Chat Interface: http://localhost:5500/chat

## Project Structure

```
voxen/
├── config/
│   ├── db.js              # Database connection and table creation
│   └── passport.js        # Passport authentication strategies
├── controllers/
│   ├── authController.js  # Authentication logic
│   ├── chatController.js  # Chat functionality
│   └── userController.js  # User management
├── middleware/
│   ├── authMiddleware.js  # JWT verification
│   └── errorMiddleware.js # Error handling
├── routes/
│   ├── index.js           # Main API router
│   ├── authRoutes.js      # Authentication routes
│   ├── userRoutes.js      # User routes
│   ├── chatRoutes.js      # Chat routes
│   └── pages.js           # Frontend page routes
├── public/
│   ├── index.html         # Login/Signup page
│   ├── home.html          # Dashboard page
│   └── chat.html          # Chat interface
├── .env                   # Environment variables (not in repo)
├── package.json           # Dependencies and scripts
├── server.js              # Main application entry point
└── README.md              # This file
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login user
- POST /api/auth/logout - Logout user
- GET /api/auth/profile - Get user profile (protected)
- GET /api/auth/google - Google OAuth login
- GET /api/auth/google/callback - Google OAuth callback

### Users
- POST /api/users/reviews - Submit a review (protected)

### Chat
- POST /api/chat/message - Send chat message (protected)
- GET /api/chat/conversations - Get user conversations (protected)

## Technologies Used

- Backend: Node.js, Express.js
- Database: PostgreSQL
- Authentication: JWT, Passport.js, Google OAuth 2.0
- Password Security: bcryptjs
- Frontend: HTML5, CSS3, Vanilla JavaScript
- AI Integration: OpenAI API

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Secure session management
- Environment variable protection
- SQL injection prevention with parameterized queries
- CORS configuration

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify database credentials in .env
- Check if the database astro_auth exists

### Port Already in Use
- Change the PORT in .env file
- Or kill the process using port 5500

### Google OAuth Not Working
- Verify Google OAuth credentials
- Ensure callback URL matches in Google Console
- Check if redirect URIs are properly configured

## Notes

- The vector extension for PostgreSQL is optional (for advanced embeddings)
- Make sure to keep your .env file secure and never commit it to Git
- Update the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Google OAuth to work

## License

This project is licensed under the ISC License.

## Links

- Repository: https://github.com/shrutissajeev-boop/voxen
- Issues: https://github.com/shrutissajeev-boop/voxen/issues

---

Made with love for seamless AI-powered conversations
