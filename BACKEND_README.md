# Smart Rental Platform — Backend

**Node.js + Express + PostgreSQL (Prisma) + Firebase Auth + Socket.io + ML Integration**

This backend implements authentication, property CRUD, search, real-time chat, and integrates with an ML microservice for fraud detection and rent prediction.

---

## Features

- **Authentication**: Firebase ID token verification → internal JWT issuance
- **Property Management**: Create, search, and upload images with fraud scoring and rent prediction
- **Real-time Chat**: Socket.io for tenant-owner messaging
- **ML Integration**: Calls FastAPI microservice for fraud detection & rent estimation
- **PostgreSQL**: Managed via Prisma ORM with User, Property, PropertyImage, Message models

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 4.x
- **Database**: PostgreSQL (Supabase or local)
- **ORM**: Prisma 5.x
- **Auth**: Firebase Admin SDK + JWT
- **Real-time**: Socket.io
- **File Upload**: Multer
- **ML Client**: Axios → FastAPI microservice

---

## Project Structure

```
.
├── src/
│   ├── index.js               # Express server + socket.io init
│   ├── middleware/
│   │   └── auth.js            # Firebase token verification + internal JWT signer
│   ├── routes/
│   │   ├── auth.js            # POST /api/auth/session
│   │   ├── properties.js      # POST /api/properties, GET /api/properties/search
│   │   └── chat.js            # GET /api/chat/conversations/:userId
│   ├── utils/
│   │   └── mlClient.js        # Axios client to call ML microservice
│   └── chatSocket.js          # Socket.io connection and message handlers
├── prisma/
│   ├── schema.prisma          # Data models: User, Property, PropertyImage, Message
│   └── seed.js                # Seed script for sample users
├── package.json
├── Dockerfile
├── .env                       # Environment variables
└── README.md
```

---

## Getting Started

### 1. Prerequisites

- **Node.js** 20+ and **npm**
- **PostgreSQL** database (local or Supabase)
- **Firebase Project** with Admin SDK credentials (optional for auth testing)
- **ML Microservice** running on port 8000 (optional; fallback returns original price)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Edit `.env` and set the following:

```env
# Database (PostgreSQL connection string)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_rental

# Firebase Admin SDK (JSON string for service account key)
# FIREBASE_ADMIN_SDK={"type":"service_account","project_id":"..."}

# JWT secret for internal token signing
JWT_SECRET=supersecretkey123

# ML microservice base URL
ML_BASE=http://localhost:8000

# Server port
PORT=4000
```

### 4. Database Setup

Run Prisma migrations to create tables:

```bash
npx prisma migrate dev --name init
```

Generate Prisma Client:

```bash
npx prisma generate
```

Seed the database with sample users:

```bash
npm run prisma:seed
```

### 5. Run the Server

**Development mode (with auto-reload):**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The server will listen on `http://localhost:4000`.

---

## API Endpoints

### Authentication

**POST /api/auth/session**

Exchange Firebase ID token for internal user record + JWT.

**Headers:**
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

**Response:**
```json
{
  "token": "<INTERNAL_JWT>",
  "user": {
    "id": "uuid",
    "firebaseId": "...",
    "email": "user@example.com",
    "role": "TENANT"
  }
}
```

---

### Properties

**POST /api/properties**

Create a new property listing with images, fraud detection, and rent prediction.

**Headers:**
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: multipart/form-data
```

**Body (FormData):**
- `title` (string)
- `description` (string)
- `price` (number)
- `address` (string)
- `city` (string)
- `country` (string)
- `features` (JSON string, e.g., `{"bedrooms":2,"bathrooms":1}`)
- `images` (file[])

**Response:**
```json
{
  "propertyId": "uuid",
  "predictedRent": 1200.50,
  "fraudScore": 0.02
}
```

---

**GET /api/properties/search**

Search properties by city, price range, and text query.

**Query Params:**
- `city` (optional)
- `minPrice` (optional)
- `maxPrice` (optional)
- `q` (optional text search)

**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Cozy 2BHK Apartment",
    "city": "Mumbai",
    "price": 1500,
    "predictedRent": 1480,
    "fraudScore": 0.01,
    "images": [
      { "id": "uuid", "url": "/uploads/123-image.jpg" }
    ]
  }
]
```

---

### Chat

**GET /api/chat/conversations/:userId**

Retrieve all messages sent to or from a user.

**Response:**
```json
[
  {
    "id": "uuid",
    "senderId": "uuid",
    "receiverId": "uuid",
    "content": "Hello!",
    "createdAt": "2025-11-08T17:00:00Z"
  }
]
```

---

### Socket.io Events

**Client → Server:**

- `join` — Join a room with `{ userId: "uuid" }`
- `message` — Send a message with `{ senderId: "uuid", receiverId: "uuid", content: "text" }`

**Server → Client:**

- `message` — Emitted to `receiverId` room when a message is stored

---

## ML Microservice Integration

The backend calls `POST {ML_BASE}/predict` with a `property` object.

**Expected ML Response:**
```json
{
  "fraudScore": 0.02,
  "predictedRent": 1480.00
}
```

If the ML service is unavailable, fallback returns:
```json
{
  "fraudScore": 0,
  "predictedRent": <original_price>
}
```

---

## Docker Setup

Build and run using Docker:

```bash
docker build -t smart-rental-backend .
docker run -p 4000:4000 --env-file .env smart-rental-backend
```

Or use docker-compose (create an `infra/docker-compose.yml` in your monorepo).

---

## Deployment

### Vercel (Frontend)

Deploy Next.js frontend to Vercel with environment variables:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`

### Render (Backend)

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Set **Build Command**: `npm install && npx prisma generate`
4. Set **Start Command**: `npm start`
5. Add environment variables:
   - `DATABASE_URL`
   - `FIREBASE_ADMIN_SDK`
   - `JWT_SECRET`
   - `ML_BASE`
   - `PORT` (auto-assigned by Render)

### Supabase (Database)

1. Create a PostgreSQL database on Supabase
2. Copy the connection string to `DATABASE_URL`
3. Run migrations locally or via CI: `npx prisma migrate deploy`

### ML Microservice

Deploy the FastAPI service to Render or a VM. Set `ML_BASE` in backend `.env` to the deployed URL.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start with nodemon for auto-reload |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run migrations in dev |
| `npm run prisma:seed` | Seed the database with sample data |

---

## Testing Checklist

- [ ] **Unit tests** for routes (Jest + Supertest)
- [ ] **Integration tests** for Prisma models and DB flows
- [ ] **E2E tests** for auth flow (Firebase emulator)
- [ ] **Load tests** for search API (k6 or Artillery)
- [ ] **ML service mocking** for fraud/rent predictions

---

## Security Notes

- **Never commit** `.env` or Firebase Admin SDK JSON to version control
- **Use environment secrets** in CI/CD (GitHub Actions Secrets, Render Environment Variables)
- **Rate-limit** critical endpoints (auth, property creation)
- **Store images** on S3 or Supabase Storage (not on local disk in production)
- **Add admin approval** workflow for properties flagged with high fraud scores

---

## Next Steps

1. **Implement the FastAPI ML microservice** (see separate repo or `/services/ml_service`)
2. **Add frontend** (Next.js + Tailwind) for login, property listing, and dashboard
3. **Set up CI/CD** with GitHub Actions (build, test, deploy)
4. **Add monitoring** (Sentry for errors, Prometheus/Grafana for metrics)
5. **Background jobs** (BullMQ) for re-evaluating properties with improved ML models

---

## License

ISC

---

## Author

**Harshit Shah**

GitHub: [HarshitShah6](https://github.com/HarshitShah6)

Repository: [Smart_Rental_Platform_Backend](https://github.com/HarshitShah6/Smart_Rental_Platform_Backend)

---

## Support

For issues or questions, open an issue on GitHub or contact the maintainer.
