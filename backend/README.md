# Krishi Nova Backend

Node.js 22, Express, MongoDB Atlas and Mongoose backend for Krishi Nova Smart Procurement.

## Principles

- No demo, mock or seed data is included.
- Farmer self-registration creates farmer accounts only.
- Staff and admin accounts are created by an authorized admin.
- Access tokens live in frontend memory; refresh tokens use an HttpOnly cookie.
- Booking capacity is checked inside a MongoDB transaction.
- Staff access is restricted to assigned centres.
- Queue updates use authenticated Socket.IO rooms.
- WhatsApp delivery is isolated from core business transactions.

## Setup

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
```

Set `MONGODB_URI`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env`. Do not commit `.env`.

The database name is `krishi_nova`. The application does not create seed records. An initial admin must be created through the approved secure administrative bootstrap process before admin-only resources can be managed.

For an empty database, set a strong `BOOTSTRAP_SECRET` in the environment and call `POST /api/auth/bootstrap` once with the `X-Bootstrap-Secret` header. The legacy-compatible `POST /api/auth/bootstrap-admin` route is also available. Both endpoints refuse to run after an admin exists.

## Commands

```powershell
npm.cmd run dev
npm.cmd start
npm.cmd test
npm.cmd run openapi:validate
```

## API

- Health: `GET /api/health`
- Swagger UI: `GET /api/docs`
- OpenAPI source: `docs/openapi.yaml`
- Postman collection: `docs/postman/KrishiNova.postman_collection.json`

All responses use `{ success, data }` for success and `{ success, message, code }` for errors.

## Deployment

Deploy the `backend` directory to Render as a Node web service. Use Node 22, build command `npm install`, and start command `npm start`. Configure all secrets and `MONGODB_URI` in Render environment variables. Configure MongoDB Atlas network access for the Render service and enable Atlas backups.

Production CORS must include the configured frontend origin and must never use `*`. Set `COOKIE_SECURE=true` in production.

## Integrations

Payment gateway, SMS and OTP providers are not enabled. WhatsApp remains disabled until Meta Business credentials, approved English/Hindi templates, webhook configuration and recipient opt-in policy are supplied.
