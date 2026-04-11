# PULSE-RTIP Backend API Guide

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Getting Started](#getting-started)
4. [Configuration](#configuration)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication)
   - [Users](#users)
   - [Reports](#reports)
   - [Hazards](#hazards)
   - [Notifications](#notifications)
   - [Dashboard](#dashboard)
   - [Media](#media)
   - [Hotlines](#hotlines)
   - [Health Check](#health-check)
7. [Error Handling](#error-handling)
8. [Deployment](#deployment)

---

## Overview

The PULSE-RTIP backend is a RESTful API built with Node.js and Express. It serves the PULSE-RTIP incident reporting web application for the Morong Disaster Risk Reduction and Management Office (MDRRMO).

**Base URL:** `http://localhost:3000/api`

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js v18+ |
| Framework | Express.js 4.x |
| Database (Production) | MySQL via mysql2 |
| Database (Offline) | SQLite via better-sqlite3 |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |
| File Upload | multer |

---

## Getting Started

### Prerequisites
- Node.js v18 or higher
- npm

### Installation
```bash
cd src/backend
npm install
```

### Database Setup
```bash
# Run migrations (creates tables)
npm run migrate

# Seed demo data (optional)
npm run seed
```

### Start Server
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

The server starts at `http://localhost:3000`.

---

## Configuration

Configuration is managed through environment variables. Create a `.env` file at the project root:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_MODE` | `offline` | `production` (MySQL) or `offline` (SQLite) |
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | - | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiration |
| `MYSQL_HOST` | `localhost` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `pulse_user` | MySQL username |
| `MYSQL_PASSWORD` | - | MySQL password |
| `MYSQL_DATABASE` | `pulse_rtip` | MySQL database name |
| `UPLOAD_DIR` | `uploads` | Upload directory path |
| `MAX_FILE_SIZE` | `5242880` | Max file size (5MB) |

---

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | VARCHAR(100) | Full name |
| email | VARCHAR(255) | Email (unique) |
| phone | VARCHAR(20) | Phone number |
| address | VARCHAR(255) | Barangay/address |
| avatar | CHAR(1) | First letter of name |
| role | VARCHAR(10) | `citizen` or `admin` |
| password_hash | VARCHAR(255) | Bcrypt hash |
| joined_date | DATETIME | Account creation date |

### reports
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| title | VARCHAR(255) | Report title |
| type | VARCHAR(50) | Flood, Fire, Infrastructure Damage, etc. |
| status | VARCHAR(20) | submitted, pending, under-review, investigating, resolved |
| description | TEXT | Detailed description |
| location | VARCHAR(255) | Location text |
| latitude | DECIMAL(10,8) | GPS latitude |
| longitude | DECIMAL(11,8) | GPS longitude |
| submitted_by | INTEGER FK | References users(id) |

### report_images
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| report_id | INTEGER FK | References reports(id) CASCADE |
| file_path | VARCHAR(500) | Path to uploaded file |

### hazard_alerts
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| title | VARCHAR(255) | Alert title |
| severity | VARCHAR(10) | high, medium, low |
| location | VARCHAR(255) | Affected area |
| description | TEXT | Alert details |
| created_by | INTEGER FK | References users(id) |

### notifications
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| user_id | INTEGER FK | Target user |
| report_id | INTEGER FK | Related report |
| title | VARCHAR(255) | Notification title |
| text | TEXT | Notification body |
| status | VARCHAR(20) | Report status at time of notification |
| is_read | INTEGER | 0 = unread, 1 = read |

### emergency_hotlines
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| category | VARCHAR(100) | MDRRMO, Police, Hospital, etc. |
| label | VARCHAR(100) | Display label |
| number | VARCHAR(50) | Phone number |
| sort_order | INTEGER | Display order |

---

## API Endpoints

### Response Format

All endpoints return JSON with this structure:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [{ "field": "email", "message": "Valid email is required" }]
}
```

---

### Authentication

#### POST /api/auth/login
Authenticate a user and receive a JWT token.

**Body:**
```json
{
  "email": "admin@mdrrmo.gov",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": 1,
      "name": "MDRRMO Admin",
      "email": "admin@mdrrmo.gov",
      "phone": "0917-135-0541",
      "address": "MDRRMO Office, Morong, Rizal",
      "avatar": "M",
      "role": "admin",
      "joinedDate": "2026-04-10 11:16:49"
    },
    "notificationCount": 0
  }
}
```

#### POST /api/auth/register
Create a new citizen account.

**Body:**
```json
{
  "name": "Juan Dela Cruz",
  "email": "juan@email.com",
  "password": "password123",
  "phone": "0917-000-0000",
  "address": "Brgy. San Pedro"
}
```

**Response (201):** Same format as login.

---

### Users

#### GET /api/users/me
Get current user's profile. **Requires auth.**

#### PUT /api/users/me
Update current user's profile. **Requires auth.**

**Body:**
```json
{
  "name": "New Name",
  "phone": "0917-111-1111",
  "address": "New Address"
}
```

---

### Reports

#### GET /api/reports
List reports. Citizens see their own; admins see all. **Requires auth.**

**Query params:** `status`, `type`, `search`

#### POST /api/reports
Create a new incident report. **Requires auth.**

**Body (multipart/form-data):**
- `title` (required): Report title
- `type` (required): Flood, Fire, Infrastructure Damage, Earthquake, Landslide, Typhoon, Others
- `description`: Detailed description
- `location`: Location text
- `latitude`: GPS latitude
- `longitude`: GPS longitude
- `images`: Up to 5 image files (JPEG, PNG, GIF)

#### GET /api/reports/:id
Get a single report with images. **Requires auth.**

#### PUT /api/reports/:id/status
Update report status. **Requires admin.** Auto-creates notification for the report submitter.

**Body:**
```json
{
  "status": "investigating"
}
```

Valid statuses: `submitted`, `pending`, `under-review`, `investigating`, `resolved`

---

### Hazards

#### GET /api/hazards
List all hazard alerts. **Requires auth.**

#### POST /api/hazards
Create a new hazard alert. **Requires admin.**

**Body:**
```json
{
  "title": "Flood Warning",
  "severity": "high",
  "location": "Main Street, Morong",
  "description": "Heavy rainfall expected."
}
```

Valid severities: `high`, `medium`, `low`

---

### Notifications

#### GET /api/notifications
List current user's notifications. **Requires auth.**

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "unreadCount": 4
  }
}
```

---

### Dashboard

#### GET /api/dashboard/stats
Get admin dashboard statistics. **Requires admin.**

**Response:**
```json
{
  "success": true,
  "data": {
    "pendingCount": 1,
    "investigatingCount": 1,
    "resolvedCount": 1,
    "hazardsCount": 3
  }
}
```

---

### Media

#### POST /api/media/upload
Upload files. **Requires auth.**

**Body (multipart/form-data):**
- `files`: Up to 5 files (JPEG, PNG, GIF, MP4). Max 5MB each.

**Response (201):**
```json
{
  "success": true,
  "data": [
    {
      "filename": "1234567890-123.jpg",
      "path": "/uploads/1234567890-123.jpg",
      "mimetype": "image/jpeg",
      "size": 102400
    }
  ]
}
```

---

### Hotlines

#### GET /api/hotlines
List all emergency hotlines. **Requires auth.**

---

### Health Check

#### GET /api/health
Check API status. **No auth required.**

---

## Error Handling

| Status | Meaning |
|--------|---------|
| 400 | Validation error (check `errors` array) |
| 401 | Authentication required or token expired |
| 403 | Insufficient permissions (admin required) |
| 404 | Resource not found |
| 409 | Conflict (e.g., email already exists) |
| 429 | Rate limit exceeded (100 req/15min) |
| 500 | Internal server error |

---

## Deployment

### To Kali Server (76.13.215.54)

1. **Deploy files:**
   ```bash
   scp -i ~/kali_openclaw -r src/ root@76.13.215.54:/opt/PULSE-RTIP/
   ```

2. **Install dependencies:**
   ```bash
   ssh -i ~/kali_openclaw root@76.13.215.54 "cd /opt/PULSE-RTIP/src/backend && npm install --production"
   ```

3. **Setup MySQL:**
   ```sql
   CREATE DATABASE pulse_rtip;
   CREATE USER 'pulse_user'@'localhost' IDENTIFIED BY '<password>';
   GRANT ALL ON pulse_rtip.* TO 'pulse_user'@'localhost';
   ```

4. **Configure .env:**
   ```bash
   APP_MODE=production
   MYSQL_HOST=localhost
   MYSQL_PASSWORD=<password>
   JWT_SECRET=<strong-random-secret>
   ```

5. **Run migrations and start:**
   ```bash
   node src/database/migrations/migrate.js
   node src/database/seeds/seed.js
   pm2 start src/backend/server.js --name pulse-rtip
   ```

### Demo Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@mdrrmo.gov | admin123 |
| Citizen | ray.lopez@email.com | citizen123 |
