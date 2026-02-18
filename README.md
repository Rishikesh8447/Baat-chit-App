# Baat-Chit

A full-stack real-time chat app with direct messaging and group chat.

## Features

- User authentication (signup, login, logout)
- Forgot/reset password flow
- Real-time messaging with Socket.IO
- Online/offline presence
- Direct chat + group chat
- Group admin controls:
  - remove members
  - delete group
  - every member can leave group
- Message actions:
  - edit message
  - delete message (with deleted marker)
  - edited/deleted status visible to other users
- Seen/unread message handling
- Message search in chat (`All`, `Text`, `Files`)
- Image message support (Cloudinary)

## Tech Stack

- Frontend: React, Vite, Zustand, Axios, Tailwind/DaisyUI, Socket.IO Client
- Backend: Node.js, Express, MongoDB (Mongoose), Socket.IO, JWT, Cookie Auth
- Media: Cloudinary

## Project Structure

```text
.
+-- backend
¦   +-- src
+-- frontend
¦   +-- src
+-- package.json
```

## Prerequisites

- Node.js 18+
- MongoDB connection string
- Cloudinary account (for image uploads)

## Environment Variables

Create `backend/.env`:

```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Installation

From project root:

```bash
npm install --prefix backend
npm install --prefix frontend
```

## Run in Development

Run backend:

```bash
npm run dev --prefix backend
```

Run frontend (new terminal):

```bash
npm run dev --prefix frontend
```

App URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001/api`

## Build and Start (Production style)

From root:

```bash
npm run build
npm start
```

## Main Scripts

Root `package.json`:

- `npm run build` installs backend/frontend dependencies and builds frontend
- `npm start` runs backend server

Backend:

- `npm run dev --prefix backend`
- `npm run start --prefix backend`

Frontend:

- `npm run dev --prefix frontend`
- `npm run build --prefix frontend`
- `npm run preview --prefix frontend`

## Notes

- Auth uses HTTP-only JWT cookies.
- CORS is configured for local frontend origins.
- Socket server and API share the same backend server instance.
