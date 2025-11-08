# Smart Rental Platform — Backend

**Node.js + Express + PostgreSQL (Prisma) + Firebase Auth + Socket.io + ML Integration**

A production-ready backend for a Smart Rental System that enables property listing, search, real-time chat, Firebase authentication, and AI-powered fraud detection & rent prediction via a FastAPI microservice.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, FIREBASE_ADMIN_SDK, JWT_SECRET

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Seed sample data
npm run prisma:seed

# Start development server
npm run dev
```

Server will be running at `http://localhost:4000`

---

## 📚 Documentation

For complete setup instructions, API reference, deployment guides, and architecture details, see **[BACKEND_README.md](./BACKEND_README.md)**.

---

## ✨ Features

- ✅ **Authentication** — Firebase ID token verification + internal JWT
- ✅ **Property Management** — Create, upload images, search with filters
- ✅ **ML Integration** — Fraud detection & rent prediction via FastAPI
- ✅ **Real-time Chat** — Socket.io for tenant-owner messaging
- ✅ **PostgreSQL + Prisma** — Type-safe ORM with migrations
- ✅ **Docker Ready** — Dockerfile included for containerized deployment
- ✅ **Production Ready** — Designed for Vercel/Render/Supabase deployment

---

## 🏗️ Project Structure

```
.
├── src/
│   ├── index.js               # Express server + socket.io
│   ├── middleware/auth.js     # Firebase + JWT verification
│   ├── routes/                # API routes (auth, properties, chat)
│   ├── utils/mlClient.js      # ML microservice integration
│   └── chatSocket.js          # Socket.io handlers
├── prisma/
│   ├── schema.prisma          # Database models
│   └── seed.js                # Sample data
├── package.json
├── Dockerfile
└── .env                       # Environment variables
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ |
| **Framework** | Express 4.x |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma 5.x |
| **Authentication** | Firebase Admin SDK + JWT |
| **Real-time** | Socket.io |
| **File Upload** | Multer |
| **ML Client** | Axios → FastAPI |

---

## 📦 Key Dependencies

```json
{
  "axios": "^1.5.0",
  "express": "^4.18.2",
  "firebase-admin": "^11.10.0",
  "jsonwebtoken": "^9.0.2",
  "multer": "^2.0.2",
  "@prisma/client": "^5.0.0",
  "socket.io": "^4.7.0",
  "cors": "^2.8.5"
}
```

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/session` | Exchange Firebase token for JWT + user |
| `POST` | `/api/properties` | Create property with ML fraud check |
| `GET` | `/api/properties/search` | Search properties by filters |
| `GET` | `/api/chat/conversations/:userId` | Retrieve user messages |

**Socket.io Events:**
- `join` — Join user room
- `message` — Send/receive messages

Full API documentation in [BACKEND_README.md](./BACKEND_README.md).

---

## 🌐 Deployment

### Render (Backend)

1. Create Web Service on Render
2. Connect GitHub repo
3. Build: `npm install && npx prisma generate`
4. Start: `npm start`
5. Add environment variables: `DATABASE_URL`, `FIREBASE_ADMIN_SDK`, `JWT_SECRET`, `ML_BASE`

### Supabase (Database)

1. Create PostgreSQL database
2. Copy connection string to `DATABASE_URL`
3. Run: `npx prisma migrate deploy`

### Docker

```bash
docker build -t smart-rental-backend .
docker run -p 4000:4000 --env-file .env smart-rental-backend
```

---

## 🧪 Testing

```bash
# Unit tests (to be implemented)
npm test

# Run Prisma Studio to inspect database
npx prisma studio
```

---

## 🔐 Security

- Firebase Admin SDK credentials stored in environment variables (never commit)
- JWT secret for internal token signing
- Rate limiting recommended for production
- Images should be stored on S3/Supabase Storage (not local disk)

---

## 📄 License

ISC

---

## 👤 Author

**Harshit Shah**

- GitHub: [@HarshitShah6](https://github.com/HarshitShah6)
- Repository: [Smart_Rental_Platform_Backend](https://github.com/HarshitShah6/Smart_Rental_Platform_Backend)

---

## 🤝 Contributing

Contributions are welcome! Please open issues or submit pull requests.

---

## 📞 Support

For questions or issues, open a GitHub issue or contact the maintainer.
