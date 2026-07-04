# Whitelist Checker

Admin dashboard for managing NFT mint whitelists across three tiers: Guaranteed (GTD), First Come First Served (FCFS), and Free.

## What It Does

- View and manage wallet address lists per tier
- Bulk add or remove addresses
- Export lists as JSON, TXT, or CSV
- JWT-authenticated admin interface

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | MongoDB |
| Frontend | React + Vite |
| Auth | JWT |
| Process | PM2 |

## Project Structure

```
whitelist-checker/
├── backend/
│   └── src/
│       ├── routes/       # auth, whitelist, public, sync
│       ├── services/     # mongoService, fileService
│       └── middleware/   # auth.js
└── frontend/
    └── src/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── ListManager.jsx
        ├── ListViewer.jsx
        └── AddressManager.jsx
```

## Environment Setup

```bash
cp .env.example backend/.env
```

## Running

```bash
# Backend
cd backend && npm install && npm start

# Frontend
cd frontend && npm install && npm run dev
```
