# Smart Rental Platform — System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                              │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │         Next.js Frontend (Vercel)                          │   │
│  │  - Login/Signup UI (Firebase Auth)                         │   │
│  │  - Property Listing & Search                               │   │
│  │  - Create Listing Form                                     │   │
│  │  - Real-time Chat UI                                       │   │
│  │  - Dashboard & Analytics                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           │ HTTPS
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                      BACKEND LAYER (Render)                         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │         Express.js Server (Node.js 20)                      │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  Middleware                                           │  │  │
│  │  │  - CORS                                               │  │  │
│  │  │  - Express JSON                                       │  │  │
│  │  │  - Firebase Token Verification                        │  │  │
│  │  │  - Internal JWT Signing                               │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  REST API Routes                                      │  │  │
│  │  │  - POST /api/auth/session                             │  │  │
│  │  │  - POST /api/properties (+ Multer uploads)            │  │  │
│  │  │  - GET  /api/properties/search                        │  │  │
│  │  │  - GET  /api/chat/conversations/:userId               │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  Socket.io Server (Real-time)                         │  │  │
│  │  │  - Events: join, message                              │  │  │
│  │  │  - Room-based messaging                               │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  ML Client (Axios)                                    │  │  │
│  │  │  - POST {ML_BASE}/predict                             │  │  │
│  │  │  - Fraud detection + Rent prediction                  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────────┐
│   PostgreSQL     │ │  Firebase   │ │  ML Microservice │
│   (Supabase)     │ │   Auth      │ │    (FastAPI)     │
│                  │ │             │ │                  │
│  Tables:         │ │ - User Auth │ │  POST /predict   │
│  - User          │ │ - ID Tokens │ │                  │
│  - Property      │ │             │ │  - Fraud Score   │
│  - PropertyImage │ │             │ │  - Rent Predict  │
│  - Message       │ │             │ │                  │
│                  │ │             │ │  (Python 3.11)   │
│  (Prisma ORM)    │ │             │ │  - scikit-learn  │
└──────────────────┘ └─────────────┘ └──────────────────┘
```

---

## Data Flow Diagrams

### 1. Authentication Flow

```
┌─────────┐                 ┌──────────┐                ┌─────────┐
│ Client  │                 │ Firebase │                │ Backend │
│ (Next)  │                 │   Auth   │                │(Express)│
└────┬────┘                 └─────┬────┘                └────┬────┘
     │                            │                          │
     │ 1. Login with Email/Google │                          │
     ├───────────────────────────>│                          │
     │                            │                          │
     │ 2. Firebase ID Token       │                          │
     │<───────────────────────────┤                          │
     │                            │                          │
     │ 3. POST /api/auth/session (Bearer Token)              │
     ├───────────────────────────────────────────────────────>│
     │                            │                          │
     │                            │ 4. Verify Token          │
     │                            │<─────────────────────────┤
     │                            │                          │
     │                            │ 5. Token Valid           │
     │                            ├─────────────────────────>│
     │                            │                          │
     │                            │                   6. Find/Create User
     │                            │                     in PostgreSQL
     │                            │                          │
     │ 7. { token: JWT, user: {...} }                        │
     │<───────────────────────────────────────────────────────┤
     │                            │                          │
     │ 8. Store JWT + User in State/Cookie                   │
     │                            │                          │
```

---

### 2. Property Creation Flow

```
┌─────────┐        ┌─────────┐        ┌──────────┐        ┌──────────┐
│ Client  │        │ Backend │        │    ML    │        │PostgreSQL│
│ (Next)  │        │(Express)│        │ Service  │        │ (Prisma) │
└────┬────┘        └────┬────┘        └─────┬────┘        └─────┬────┘
     │                  │                   │                   │
     │ 1. POST /api/properties (multipart/form-data)           │
     │    - title, description, price, images, etc.            │
     ├─────────────────>│                   │                   │
     │                  │                   │                   │
     │                  │ 2. Verify Firebase Token              │
     │                  │                   │                   │
     │                  │ 3. Store images (Multer)              │
     │                  │                   │                   │
     │                  │ 4. Create Property record             │
     │                  ├───────────────────────────────────────>│
     │                  │                   │                   │
     │                  │ 5. Property ID    │                   │
     │                  │<───────────────────────────────────────┤
     │                  │                   │                   │
     │                  │ 6. POST /predict (property data)      │
     │                  ├──────────────────>│                   │
     │                  │                   │                   │
     │                  │ 7. { fraudScore, predictedRent }      │
     │                  │<──────────────────┤                   │
     │                  │                   │                   │
     │                  │ 8. Update Property with ML results    │
     │                  ├───────────────────────────────────────>│
     │                  │                   │                   │
     │ 9. { propertyId, predictedRent, fraudScore }            │
     │<─────────────────┤                   │                   │
     │                  │                   │                   │
```

---

### 3. Property Search Flow

```
┌─────────┐                 ┌─────────┐                 ┌──────────┐
│ Client  │                 │ Backend │                 │PostgreSQL│
│ (Next)  │                 │(Express)│                 │ (Prisma) │
└────┬────┘                 └────┬────┘                 └─────┬────┘
     │                           │                            │
     │ 1. GET /api/properties/search?city=Mumbai&minPrice=1000│
     ├──────────────────────────>│                            │
     │                           │                            │
     │                           │ 2. Build Prisma query      │
     │                           │    (filters + includes)    │
     │                           │                            │
     │                           │ 3. SELECT * FROM Property  │
     │                           │    WHERE city = 'Mumbai'   │
     │                           ├───────────────────────────>│
     │                           │                            │
     │                           │ 4. Return results + images │
     │                           │<───────────────────────────┤
     │                           │                            │
     │ 5. JSON array of properties                            │
     │<──────────────────────────┤                            │
     │                           │                            │
```

---

### 4. Real-time Chat Flow

```
┌─────────┐                 ┌─────────┐                 ┌──────────┐
│ Client  │                 │ Backend │                 │PostgreSQL│
│ (Next)  │                 │Socket.io│                 │ (Prisma) │
└────┬────┘                 └────┬────┘                 └─────┬────┘
     │                           │                            │
     │ 1. Connect to Socket.io   │                            │
     ├──────────────────────────>│                            │
     │                           │                            │
     │ 2. Emit 'join' { userId } │                            │
     ├──────────────────────────>│                            │
     │                           │                            │
     │                           │ 3. Join room (userId)      │
     │                           │                            │
     │ 4. Emit 'message' { senderId, receiverId, content }    │
     ├──────────────────────────>│                            │
     │                           │                            │
     │                           │ 5. INSERT INTO Message     │
     │                           ├───────────────────────────>│
     │                           │                            │
     │                           │ 6. Message record          │
     │                           │<───────────────────────────┤
     │                           │                            │
     │                           │ 7. Emit 'message' to       │
     │                           │    receiverId room         │
     │                           │                            │
     │ 8. Receive 'message' event│                            │
     │<──────────────────────────┤                            │
     │                           │                            │
```

---

## Database Schema (Prisma)

```
┌──────────────────────────────┐
│          User                │
├──────────────────────────────┤
│ id         UUID (PK)         │
│ firebaseId String (Unique)   │
│ email      String (Unique)   │
│ name       String?           │
│ role       Role (TENANT/     │
│            OWNER/ADMIN)      │
│ createdAt  DateTime          │
└──────────────┬───────────────┘
               │ 1:N
               │
┌──────────────▼───────────────┐
│        Property              │
├──────────────────────────────┤
│ id            UUID (PK)      │
│ ownerId       UUID (FK)      │
│ title         String         │
│ description   String         │
│ price         Float          │
│ predictedRent Float?         │
│ fraudScore    Float?         │
│ address       String         │
│ city          String         │
│ country       String         │
│ features      JSON           │
│ createdAt     DateTime       │
└──────────────┬───────────────┘
               │ 1:N
               │
┌──────────────▼───────────────┐
│      PropertyImage           │
├──────────────────────────────┤
│ id         UUID (PK)         │
│ propertyId UUID (FK)         │
│ url        String            │
└──────────────────────────────┘

┌──────────────────────────────┐
│         Message              │
├──────────────────────────────┤
│ id         UUID (PK)         │
│ senderId   UUID (FK)         │
│ receiverId UUID (FK)         │
│ content    String            │
│ createdAt  DateTime          │
└──────────────────────────────┘
     │              │
     │ N:1          │ N:1
     │              │
     └──────┬───────┘
            │
    ┌───────▼────────┐
    │     User       │
    └────────────────┘
```

---

## Technology Stack

### Frontend (Next.js)
- **Framework:** Next.js 13+
- **Styling:** Tailwind CSS
- **State Management:** React Context / SWR
- **Authentication:** Firebase Client SDK
- **Real-time:** Socket.io Client
- **HTTP Client:** Axios
- **Deployment:** Vercel

### Backend (Express)
- **Runtime:** Node.js 20+
- **Framework:** Express 4.x
- **Database:** PostgreSQL 15+
- **ORM:** Prisma 5.x
- **Authentication:** Firebase Admin SDK + JWT
- **Real-time:** Socket.io Server
- **File Upload:** Multer
- **ML Client:** Axios
- **Deployment:** Render / Docker

### ML Microservice (FastAPI)
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **ML Libraries:** scikit-learn, pandas, numpy
- **Deployment:** Render / Docker

### Database (PostgreSQL)
- **Hosting:** Supabase
- **ORM:** Prisma (Type-safe, auto-migrations)
- **Models:** User, Property, PropertyImage, Message

### DevOps
- **CI/CD:** GitHub Actions
- **Containerization:** Docker + docker-compose
- **Version Control:** Git + GitHub
- **Monitoring:** Sentry (errors), Prometheus/Grafana (metrics)

---

## Deployment Architecture (Production)

```
                          ┌─────────────────┐
                          │   Users/Clients │
                          └────────┬────────┘
                                   │
                                   │ HTTPS
                                   │
                   ┌───────────────┼───────────────┐
                   │               │               │
                   ▼               ▼               ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │    Vercel    │ │    Render    │ │   Render     │
          │  (Frontend)  │ │  (Backend)   │ │ (ML Service) │
          │              │ │              │ │              │
          │  Next.js     │ │  Express     │ │  FastAPI     │
          │  Static +    │ │  + Socket.io │ │  + ML Models │
          │  API Routes  │ │              │ │              │
          └──────────────┘ └──────┬───────┘ └──────────────┘
                                  │
                                  │
                          ┌───────▼────────┐
                          │   Supabase     │
                          │   PostgreSQL   │
                          │   + Storage    │
                          └────────────────┘

          ┌──────────────────────────────────────────┐
          │         Firebase Authentication          │
          │         (Google Identity Platform)       │
          └──────────────────────────────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Layers                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Network Layer                                                │
│    - HTTPS/TLS encryption                                       │
│    - CORS configuration                                         │
│    - Rate limiting (Render/Cloudflare)                          │
├─────────────────────────────────────────────────────────────────┤
│ 2. Authentication Layer                                         │
│    - Firebase ID token verification                             │
│    - Internal JWT with short expiry (1h)                        │
│    - Role-based access control (TENANT/OWNER/ADMIN)             │
├─────────────────────────────────────────────────────────────────┤
│ 3. Application Layer                                            │
│    - Input validation (Prisma schema constraints)               │
│    - SQL injection protection (Prisma parameterized queries)    │
│    - XSS protection (Express JSON sanitization)                 │
├─────────────────────────────────────────────────────────────────┤
│ 4. Data Layer                                                   │
│    - Environment variable secrets (not in git)                  │
│    - PostgreSQL SSL/TLS connections                             │
│    - Encrypted credentials (Firebase Admin SDK)                 │
├─────────────────────────────────────────────────────────────────┤
│ 5. File Upload Security                                         │
│    - File type validation (images only)                         │
│    - File size limits (Multer configuration)                    │
│    - Stored on S3/Supabase (not local disk in production)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monitoring & Observability

```
┌──────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                          │
├──────────────────────────────────────────────────────────────┤
│ Error Tracking:    Sentry (application errors)               │
│ Logs:              Render logs / CloudWatch                  │
│ Metrics:           Prometheus + Grafana                      │
│ Uptime:            UptimeRobot / Better Uptime               │
│ Database:          Supabase Dashboard (query performance)    │
│ API Performance:   Response time monitoring                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements

1. **Background Jobs** (BullMQ)
   - Re-evaluate fraud scores with improved ML models
   - Send email/SMS notifications
   - Generate analytics reports

2. **Caching** (Redis)
   - Cache popular search results
   - Cache user sessions
   - Rate limiting storage

3. **CDN** (CloudFront / Cloudflare)
   - Serve property images from CDN
   - Cache static assets

4. **Advanced ML**
   - Computer Vision for image fraud detection
   - NLP for description analysis
   - Recommendation engine for property suggestions

5. **Admin Dashboard**
   - Review flagged properties
   - User management
   - Analytics and reporting

6. **Payment Integration** (Stripe)
   - Security deposits
   - Rent collection
   - Commission processing

---

For detailed implementation, see:
- [BACKEND_README.md](./BACKEND_README.md)
- [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
