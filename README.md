# BillFlow — Invoice Management System

## Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: Vanilla HTML + CSS + JavaScript (Single Page App)
- **Auth**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs

---

## Project Structure
```
billing-app/
├── db/
│   ├── pool.js          # PostgreSQL connection pool
│   └── schema.sql       # Database schema + seed data
├── middleware/
│   └── auth.js          # JWT auth + role guard
├── routes/
│   ├── auth.js          # Login, /me
│   ├── users.js         # User CRUD (SuperAdmin)
│   └── invoices.js      # Invoice CRUD + stats
├── public/
│   └── index.html       # Full responsive SPA frontend
├── .env                 # Environment variables
└── server.js            # Express app entry point
```

---

## Setup Instructions

### 1. PostgreSQL Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE billing_db;
\c billing_db

# Run schema
\i db/schema.sql
```

### 2. Configure .env
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=billing_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
```

### 3. Install & Run
```bash
npm install
npm start
# → http://localhost:3000
```

---

## Default Login
| Field    | Value                  |
|----------|------------------------|
| Email    | admin@billing.com      |
| Password | password               |
| Role     | SuperAdmin             |

---

## API Endpoints

### Auth
| Method | Endpoint         | Description        |
|--------|------------------|--------------------|
| POST   | /api/auth/login  | Login, get JWT     |
| GET    | /api/auth/me     | Get current user   |

### Users (SuperAdmin only)
| Method | Endpoint              | Description        |
|--------|-----------------------|--------------------|
| GET    | /api/users            | List all users     |
| POST   | /api/users            | Create user        |
| PUT    | /api/users/:id        | Update user        |
| DELETE | /api/users/:id        | Delete user        |
| PATCH  | /api/users/:id/password | Change password  |

### Invoices
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | /api/invoices               | List invoices            |
| GET    | /api/invoices/:id           | Get invoice + items      |
| POST   | /api/invoices               | Create invoice (Admin)   |
| PUT    | /api/invoices/:id           | Update invoice (Admin)   |
| PATCH  | /api/invoices/:id/status    | Update status (Admin)    |
| DELETE | /api/invoices/:id           | Delete invoice (Admin)   |
| GET    | /api/invoices/stats/summary | Dashboard stats (Admin)  |

---

## Features
- ✅ SuperAdmin can create/edit/delete Users
- ✅ SuperAdmin can create/assign invoices to any user
- ✅ Users can only view their own invoices
- ✅ Invoice line items with auto-calculated totals
- ✅ GST tax + discount support
- ✅ Invoice statuses: Draft → Sent → Paid / Overdue / Cancelled
- ✅ Printable invoice preview
- ✅ Dashboard with KPI cards
- ✅ Search & filter invoices
- ✅ Fully responsive (mobile + desktop)
- ✅ JWT authentication (8hr sessions)
