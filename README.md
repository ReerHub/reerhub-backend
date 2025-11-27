🚀 Searchly Backend

A modern, secure authentication backend built with Node.js, Express, MongoDB, and Redis.
It provides:

User registration with email verification

Login with OTP

JWT access + refresh token system

Redis-based session management

CSRF protection

Clean project structure with validation, middlewares, and error handling

This backend powers the future Searchly job platform.

📦 Tech Used

Node.js (ES Modules)

Express.js

MongoDB + Mongoose

Redis (sessions, OTP, verification tokens)

JWT authentication

Nodemailer (email)

Zod validation

ESLint + Prettier + Husky

🧩 Project Setup
1️⃣ Clone the Repository
git clone https://github.com/arfat-sayyed/searchly-backend.git
cd searchly-backend

2️⃣ Install Dependencies
npm install

3️⃣ Create .env File

Inside the root folder, create .env:

PORT=8000

MONGO_URI=your-mongodb-uri
REDIS_URL=your-redis-url

SMTP_USER=your-email
SMTP_PASSWORD=your-smtp-pass

JWT_ACCESS_TOKEN_SECRET=your-secret
JWT_REFRESH_TOKEN_SECRET=your-secret

FRONTEND_URL=http://localhost:5173

4️⃣ Start Development Server
npm run dev

5️⃣ Start Production Server
npm start

🚀 API Base URL
http://localhost:8000/api/v1

📂 Main Routes
Auth Routes (/api/v1/auth)

POST /register

POST /verify/:token

POST /login

POST /verify

POST /refresh

POST /logout

POST /refresh-csrf

User Routes (/api/v1/user)

GET /me (requires auth)

✔ Ready to Push & Deploy

This backend is production-safe and ready for:

GitHub CI/CD

Docker

AWS deployment

Frontend integration
