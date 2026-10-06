# WorkLoco
### Hyperlocal & Nationwide Cross-Platform Job Discovery & Direct-Connect Platform

WorkLoco is a cross-platform solution (Android, iOS, Web, Desktop) engineered for the Indian socio-economic landscape. It addresses unemployment and underemployment across white-collar, grey-collar, blue-collar, and micro-local gig roles.

---

## 🌟 Core Value Propositions
- **Hybrid Auto-Complete + Custom Keyword Search**: Instant typeahead with zero-friction custom role submission.
- **Geospatial Proximity Radar**: Live radius search (<150ms spatial queries) matching neighborhood employers and local candidates.
- **Automated Lifecycle & Expiry Engine**: Auto-expires stale jobs after 7/14/30 days or when hired quota is met, preserving platform trust.
- **1-Tap Direct Application**: Frictionless application with rich portfolio attachments (YouTube, Drive, Behance) and audio introductions.
- **Bharat Modernity Design System**: High-contrast, accessible, outdoor-optimized theme (`#D94A26` Deep Terracotta, `#F59E0B` Saffron Gold, `#059669` Forest Emerald).

---

## 🏗 System Architecture

```
                      Cross-Platform Frontend (Flutter / Web)
                        [Android | iOS | Web | Desktop]
                                    │
                                HTTPS / WSS
                                    ▼
                      API Gateway & Load Balancer (NGINX)
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
  Auth & User Service     Jobs & Spatial Search       Notification &
  (Node.js / Express)     Service (Node.js + PostGIS)  Lifecycle Engine
                                                        (Node.js + Redis BullMQ)
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
                    Primary DB: PostgreSQL + PostGIS
                    Cache Layer: Redis
                    Object Storage: S3 / Cloudflare R2
```

---

## 📁 Repository Structure

```
workloco/
├── apps/
│   ├── web_client/                 # Interactive Web UI (Proximity Radar, Hybrid Search, Job Posting)
│   ├── flutter_client/             # Universal Mobile/Desktop App (Android, iOS, macOS, Windows)
│   └── backend_api/                # Node.js TypeScript API (PostGIS spatial queries, BullMQ expiry)
├── database/
│   ├── schema.sql                  # PostgreSQL + PostGIS schema & GIST spatial indexes
│   └── seeds/                      # Pre-populated Indian job titles & sample hyperlocal postings
├── docker-compose.yml               # Local development stack (PostgreSQL + PostGIS + Redis)
└── README.md
```

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
- Node.js >= 18 (Current environment: Node v25)
- Docker & Docker Compose (for PostgreSQL/PostGIS & Redis)
- Flutter SDK (optional, for native mobile/desktop compilation)


### Getting Started
1. Run the local backend & database services:
   ```bash
   docker compose up -d
   ```
2. Launch the backend API & Web Client (running unified on port 5005):
   ```bash
   cd apps/backend_api && npm install && npm start
   ```
3. Open your browser at `http://localhost:5005` to explore the live web application.

---

## 🔐 Production-Simulated Authentication & Navigation
- **Guest-First Clean Slate**: No hardcoded sessions. Guests freely browse hyperlocal jobs nationwide; interactive actions ("Apply Now", "Post a Job", "My Profile") dynamically prompt the Auth Guard modal.
- **Dynamic OTP Engine**: Mobile phone and email verification dispatches realistic 6-digit dynamic OTPs with banner notifications and accepts any valid 6-digit code for testing.
- **Google OAuth Simulation**: Interactive account chooser modal featuring multiple accounts, custom profile creation, and explicit primary role selection ("Job Seeker" vs. "Job Provider").
- **Working Session Management & Sign Out**: Top-left "W" brand menu features a dedicated "Sign Out" button that clears all active session state and `localStorage`, cleanly returning the user to the guest landing page.
- **Instant Brand Navigation**: Clicking the "WorkLoco" header logo resets all active query, category, and radius filters back to the clean home state.
- **Real-Time Geolocation & City Quick-Switch**: 1-click Live GPS locating alongside fast presets for Guntur, Hyderabad, Bangalore, Mumbai, and Delhi.

---

## ⚡ Founder Admin Dashboard & RBAC Enforcement

### 1. Route & Role-Based Access Control (`/admin` or `/founder-dashboard`)
- **Strict RBAC Middleware**: Routes under `/api/v1/admin/*` and the frontend `/admin` view require `role === 'ADMIN'`.
- **Non-Admin Block**: If a guest or non-admin user navigates directly to `/admin`, access is denied with a toast notification alert (`⛔ Access Denied: Founder Admin privileges required`), and the user is redirected to the home view.
- **Drawer Entry Point**: The top-left "W" menu dynamically reveals the **"Admin Console"** item *only* when authenticated as an Administrator.

### 2. Admin Modules
1. **System Overview (KPIs)**: Real-time platform counters for Registered Users (Seekers vs. Employers vs. Admins), Active vs. Expired vs. Filled Jobs, Applications submitted today, and Flagged listings count.
2. **Employer Moderation & Security**: Full provider management with instant toggle switches for the Emerald "Verified Employer" badge, plus 1-tap Account Suspension and Banning for suspicious profiles.
3. **Job Lifecycle Manager**: Filter all platform job postings by title, city, and status. Direct actions to **Force Expire**, **Extend Expiry (+7d, +14d, +30d)**, or permanently **Delete Post**.
4. **Fraud & Scam Moderation Queue**: Triage queue of seeker reports (e.g., advance registration fees, fake locations, scams) with 1-tap **"Take Down Job Post"** and **"Dismiss Flag"** capabilities.
5. **Regional & City Analytics**: Real-time breakdown of job volume, vacancies, and employer density across Guntur, Hyderabad, Bangalore, Mumbai, Delhi, and custom locations.

### 3. Admin REST APIs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/stats` | Fetches platform KPI metrics and regional city analytics |
| `GET` | `/api/v1/admin/jobs` | Fetches all platform jobs with search, city, and status filters |
| `PATCH` | `/api/v1/admin/jobs/:jobId/status` | Updates job lifecycle status (`ACTIVE`, `EXPIRED`, `REMOVED`, `PAUSED`) |
| `POST` | `/api/v1/admin/jobs/:jobId/extend` | Extends job duration by 7, 14, or 30 days |
| `POST` | `/api/v1/admin/jobs/:jobId/dismiss-flag` | Clears scam reports and restores post to `ACTIVE` |
| `DELETE` | `/api/v1/admin/jobs/:jobId` | Permanently deletes malicious or non-compliant postings |
| `GET` | `/api/v1/admin/employers` | Fetches all registered job providers with verification status |
| `PATCH` | `/api/v1/admin/employers/:userId/verify` | Toggles employer verified badge and cascades to listings |
| `PATCH` | `/api/v1/admin/employers/:userId/status` | Sets employer status (`ACTIVE`, `SUSPENDED`, `BANNED`) |
| `GET` | `/api/v1/admin/reports` | Fetches flagged job scam reports queue |
| `POST` | `/api/v1/admin/reports/:reportId/takedown` | Takes down flagged job and resolves the report |
| `POST` | `/api/v1/admin/reports/:reportId/dismiss` | Dismisses false or unverified reports |


