# 🚀 Quick Setup Guide for Smart Rental Platform Backend

Follow these steps to get the backend running on your local machine in under 5 minutes.

---

## Prerequisites

Before starting, make sure you have:

- ✅ **Node.js 20+** ([Download](https://nodejs.org/))
- ✅ **PostgreSQL** installed locally OR a Supabase account ([Get Started](https://supabase.com/))
- ✅ **Git** installed
- ✅ A code editor (VS Code recommended)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/HarshitShah6/Smart_Rental_Platform_Backend.git
cd Smart_Rental_Platform_Backend
```

---

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages (~372 packages, takes ~30 seconds).

---

## Step 3: Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` in your editor and update the following:

### 3.1 Database Connection

**Option A: Local PostgreSQL**

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_rental
```

Create the database:

```bash
psql -U postgres -c "CREATE DATABASE smart_rental;"
```

**Option B: Supabase (Recommended)**

1. Go to [Supabase](https://supabase.com/) and create a new project
2. Copy the connection string from Settings → Database → Connection String (Direct)
3. Paste it in `.env`:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[REGION].pooler.supabase.com:5432/postgres
```

### 3.2 Firebase Admin SDK (Optional for Auth Testing)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create/select a project
3. Go to Project Settings → Service Accounts → Generate New Private Key
4. Copy the entire JSON and **convert it to a single line** (no line breaks)
5. Add to `.env`:

```env
FIREBASE_ADMIN_SDK={"type":"service_account","project_id":"...","private_key":"..."}
```

**Note:** If you don't have Firebase set up, you can skip this. Auth endpoints will fail gracefully.

### 3.3 Other Variables

```env
JWT_SECRET=your-super-secret-key-change-this-in-production
ML_BASE=http://localhost:8000
PORT=4000
```

---

## Step 4: Set Up the Database

### 4.1 Generate Prisma Client

```bash
npx prisma generate
```

### 4.2 Run Database Migrations

This creates all tables (User, Property, PropertyImage, Message):

```bash
npx prisma migrate dev --name init
```

You should see:
```
✔ Generated Prisma Client
✔ Applied migration 20xx_init
```

### 4.3 Seed Sample Data (Optional)

Add two sample users (Owner + Tenant):

```bash
npm run prisma:seed
```

---

## Step 5: Start the Server

### Development Mode (with auto-reload):

```bash
npm run dev
```

### Production Mode:

```bash
npm start
```

You should see:

```
Backend listening on 4000
```

🎉 **Server is running at http://localhost:4000**

---

## Step 6: Test the API

### Test Health Endpoint

```bash
curl http://localhost:4000
```

**Expected Response:**
```json
{"ok": true}
```

### Test Property Search

```bash
curl http://localhost:4000/api/properties/search
```

**Expected Response:**
```json
[]
```

(Empty array because no properties exist yet)

---

## Step 7: Optional — View Database in Prisma Studio

Open a beautiful GUI to view/edit your database:

```bash
npx prisma studio
```

This opens http://localhost:5555 with your database tables.

---

## Step 8: Optional — Test with Firebase Auth

1. Set up a Next.js frontend or use Postman
2. Get a Firebase ID token from your Firebase client
3. Test the auth endpoint:

```bash
curl -X POST http://localhost:4000/api/auth/session \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "TENANT"
  }
}
```

---

## Troubleshooting

### ❌ `Connection refused` on database

**Fix:** Make sure PostgreSQL is running or check your `DATABASE_URL` in `.env`

### ❌ `Firebase admin not initialized`

**Fix:** This is expected if you don't have `FIREBASE_ADMIN_SDK` set. Auth endpoints will return 401. Add the Firebase Admin SDK JSON to `.env` to fix.

### ❌ `ML service error`

**Fix:** This is expected if you don't have the ML microservice running. The backend will use fallback values (fraudScore=0, predictedRent=original price).

### ❌ Port 4000 already in use

**Fix:** Change `PORT` in `.env` to a different port (e.g., 5000) or kill the process using port 4000:

```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :4000
kill -9 <PID>
```

---

## Next Steps

✅ Backend is running!

Now you can:

1. **Build the ML Microservice** (FastAPI) for fraud detection & rent prediction
2. **Build the Frontend** (Next.js + Tailwind) for UI
3. **Add Tests** (Jest + Supertest)
4. **Deploy to Production** (Render + Supabase)

See [BACKEND_README.md](./BACKEND_README.md) for detailed API documentation and deployment guides.

---

## Useful Commands

```bash
# Start dev server with auto-reload
npm run dev

# Start production server
npm start

# Generate Prisma Client (after schema changes)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Deploy migrations to production
npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# View logs
# (Server logs print to console)
```

---

## Getting Help

- 📖 [Full Backend Docs](./BACKEND_README.md)
- 📝 [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- 🐛 [Report Issues](https://github.com/HarshitShah6/Smart_Rental_Platform_Backend/issues)

---

**Happy Coding! 🚀**
