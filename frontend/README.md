# Sentinel Platform — Frontend

React + TypeScript + Tailwind single-page app for the Sentinel security platform
(analyst dashboard, alerts & investigations, subject-access, monitoring notice).

## Setup

```bash
npm install                 # .npmrc sets legacy-peer-deps for react-scripts 5 + TS 5
cp .env.example .env        # optional: set REACT_APP_API_URL / REACT_APP_ORG_ID
npm start                   # dev server on http://localhost:3000
npm run build               # production build in build/
```

The backend must be running (default `http://localhost:5000`). See the root
`README.md` for the full stack.

## Structure

```
src/
  api/         axios client (auth + refresh) and typed endpoint wrappers
  auth/        AuthContext + role-gated ProtectedRoute
  hooks/       useLiveAlerts (Socket.IO)
  components/  Layout + shared UI (Card, Badge, StatCard, …)
  pages/       Login, Dashboard, Alerts, MyData, Privacy
  types.ts     shared types mirroring the API
```

## Notes

- Built on Create React App (react-scripts), which is in maintenance mode.
  Migrating to Vite is a recommended future step (it would also remove the
  `.npmrc` peer-deps workaround).
