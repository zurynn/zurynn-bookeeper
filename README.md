# Zurynn Book Keeper

A production-ready, QuickBooks-comparable bookkeeping SaaS application.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: MySQL + Drizzle ORM
- **Auth**: JWT (access + refresh tokens) + bcrypt
- **State**: Zustand + TanStack Query v5

## Quick Start

### Prerequisites
- Node.js 18+
- Docker + Docker Compose
- npm 9+

### Development Setup

1. Clone and install:
```bash
git clone <repo>
cd zurynn-book-keeper
cp .env.example .env
npm install
```

2. Start MySQL (Docker):
```bash
docker-compose up mysql -d
```

3. Run migrations:
```bash
npm run db:migrate
npm run db:seed
```

4. Start dev servers:
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Docker (Full Stack)
```bash
docker-compose up
```

## Default Credentials (after seed)
- Email: admin@demo.com
- Password: Demo1234!

## Architecture
See the `docs/` folder for detailed architecture documentation.
