# Task-Manager (FocusOS)

Time-management app with calendar planning, statistics, and achievements.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL

## Features

- Auth (register/login)
- Weekly calendar with tasks and entries
- Drag-and-drop planning
- Statistics (done/not done, efficiency chart)
- Achievements with levels

## PostgreSQL + Prisma (local)

1. In `server/.env` set:
   - `DATABASE_URL=postgresql://...`
   - `JWT_SECRET=...`
   - `CORS_ORIGIN=http://localhost:5173`
2. Run in `server/`:
   - `npm install`
   - `npm run prisma:generate`
   - `npm run prisma:migrate:deploy`
   - `npm run dev`

## Deploy on Render (free PostgreSQL)

1. Create a **PostgreSQL** instance in Render (Free).
2. Create a **Web Service** for `server/`:
   - Build Command: `npm install && npm run prisma:generate && npm run prisma:migrate:deploy`
   - Start Command: `npm run start`
3. Set Environment Variables in Render service:
   - `DATABASE_URL` = connection string from Render Postgres
   - `JWT_SECRET` = strong random secret
   - `CORS_ORIGIN` = your frontend URL
   - `PORT` = `10000` (or leave default Render port handling)
4. Deploy service and verify `GET /health`.
5. (Optional) Deploy frontend separately (Render Static Site / Vercel) and set `VITE_API_URL` to backend URL.
