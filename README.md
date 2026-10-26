# NamsaMart Health Sciences

A mobile-first learning and collaboration PWA for Nursing, Midwifery, and Mental Health students, lecturers, and administrators. Students can study course resources, practise timed quizzes, join live classes, follow announcements, and track past-paper revision. Lecturers can publish learning content, run quizzes, schedule classes, and share department updates. Administrators manage accounts and course catalogues and approve lecturer materials.

## Technology

- **Web:** React, Vite, TypeScript, Tailwind CSS, Framer Motion, React Router, PWA service worker
- **API:** Node.js, Express, TypeScript, Zod, JWT, Socket.IO
- **Data:** PostgreSQL and Prisma
- **Providers:** Cloudinary uploads, Daily.co live rooms, SMTP password reset
- **Deployment:** Docker Compose, PostgreSQL, Nginx, OpenAPI 3.0

## Project layout

```text
apps/
  api/
    prisma/              Prisma schema, migrations, seed data
    src/
      middleware/        JWT authentication, role checks, request validation
      routes/            Auth, course, material, quiz, class, news, notification, admin APIs
      services/          Cloudinary uploads
  web/
    public/              PWA application icon
    src/
      auth/               Authentication state
      components/         Navigation, responsive shell, shared controls
      pages/              Auth, dashboard, library, assessments, classes, news, settings
packages/
  shared/                 Zod schemas and shared TypeScript definitions
docker/                   Nginx SPA and API proxy configuration
openapi.yaml              API testing and integration specification
```

## Requirements

- Node.js 22 or later and npm 10 or later
- Docker Desktop / Docker Engine with Compose (recommended for PostgreSQL and deployment)
- Cloudinary, Daily.co, and SMTP credentials for their respective integrations

## Local development

1. Copy `.env.example` to `.env` and replace the example JWT and database passwords. Keep `.env` private.
2. Start PostgreSQL:

   ```sh
   docker compose up -d db
   ```

3. Install dependencies and initialize the database:

   ```sh
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. Start the API and Vite client:

   ```sh
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173). The API liveness check is [http://localhost:4000/api/health/live](http://localhost:4000/api/health/live); readiness at `/api/health/ready` also verifies PostgreSQL connectivity.

The root `.env` is loaded by the API and Prisma CLI. The web development server proxies `/api` and `/socket.io` to the local API.

## Firebase Hosting (web client)

Firebase Hosting can serve the React/Vite PWA. It does not host the Express API or Socket.IO server; deploy those separately to a Node.js service that supports long-lived HTTP/WebSocket connections, such as Cloud Run, and connect that service to the production PostgreSQL database.

1. Deploy the API first and note its HTTPS origin (for example, `https://namsamart-api-xxxxx-uc.a.run.app`). Configure the API with `NODE_ENV=production`, `WEB_ORIGIN` set to the Firebase Hosting origin (initially `https://<firebase-project-id>.web.app`), `APP_URL` set to the same public app URL, the production database URL, a unique JWT secret, and any provider credentials used by the app. Add the final custom domain to `WEB_ORIGIN` and `APP_URL` if one is configured.
2. Copy `apps/web/.env.production.example` to `apps/web/.env.production` and set:

   ```dotenv
   VITE_API_URL=https://your-api-service.run.app/api
   VITE_SOCKET_URL=https://your-api-service.run.app
   ```

   `VITE_API_URL` is the API base URL including `/api`; `VITE_SOCKET_URL` is the API service origin. These values are public and are embedded in the frontend at build time; never put credentials or secrets in `VITE_*` variables. If `VITE_SOCKET_URL` is omitted, the app derives it from the API URL.
3. Install and authenticate the Firebase CLI, then build and deploy from the repository root:

   ```sh
   npm install --global firebase-tools
   firebase login
   npm run build:firebase --workspace @namsamart/web
   firebase deploy --only hosting --project <firebase-project-id>
   ```

   The Firebase-specific build command requires a real HTTPS API URL and rejects missing, placeholder, localhost, or non-HTTPS configuration before creating deployable assets. The Socket.IO URL is optional when it shares the API origin, and is validated when supplied. The checked-in [firebase.json](./firebase.json) publishes `apps/web/dist`, provides the SPA route fallback, avoids stale service-worker caching, and sets baseline browser security headers. The Firebase project ID and production `.env` file are intentionally not committed.
4. Confirm the deployed app can sign in, load an authenticated API screen, and connect to notifications and class chat. In the browser network panel, API calls should go to the configured HTTPS API URL and Socket.IO should establish its connection to the configured API origin. A custom domain requires adding that exact HTTPS origin to the API `WEB_ORIGIN` setting.

Firebase Hosting and the API are separate origins in this setup, so the API's Express and Socket.IO CORS allowlist must use the exact public Hosting origin. Do not point the frontend at `localhost` in a production build. API and Socket.IO endpoints are configured independently to support deployments where they use different service URLs.

### Seed accounts

The seed creates five **development-only** accounts (one administrator, one lecturer, and students from all three departments). The password is the `SEED_PASSWORD` value in `.env` (default: `StudyNamsa!2026`).

| Role | Email |
| --- | --- |
| Administrator | `admin@namsamart.edu` |
| Lecturer | `lecturer@namsamart.edu` |
| Nursing student | `student@namsamart.edu` |
| Midwifery student | `midwifery@namsamart.edu` |
| Mental Health student | `mentalhealth@namsamart.edu` |

Change or remove seeded credentials before exposing any environment beyond local development. The seed is idempotent and updates these development accounts to the configured `SEED_PASSWORD`.

### Docker Compose

For a containerized application, copy `.env.example` to `.env`, replace the example secrets, set `NODE_ENV=production`, set `WEB_ORIGIN` and `APP_URL` to the public HTTPS URL, and use a unique `JWT_SECRET` and strong `POSTGRES_PASSWORD`. Keep database passwords URL-safe (letters and numbers) because Compose uses the password in the database URL. Then run:

```sh
docker compose up --build -d
```

Compose applies checked-in Prisma migrations before the API starts. Only the web service is published; the API stays on the internal Compose network behind Nginx. Put a TLS-enabled ingress or reverse proxy in front of port 8080 and forward the original client address. PostgreSQL data persists in the `postgres_data` volume. `docker compose down` stops services; `docker compose down -v` also deletes local database data.

Create the first administrator once, using secrets supplied by your deployment secret manager rather than committing them to `.env` or shell history:

```sh
docker compose exec -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_PASSWORD api npm run admin:bootstrap
```

Set those three variables in the invoking environment before running the command. The bootstrap command refuses to create another administrator if one already exists. Do not run the development seed in production; it is disabled when `NODE_ENV=production`.

The root `Dockerfile` provides an API target and a static Nginx PWA target. Nginx serves the SPA with history fallback and proxies API and Socket.IO traffic to the API container.

## Environment variables

See [.env.example](./.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by local development and Prisma |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Compose database configuration |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Signing key and lifetime for access tokens |
| `TRUST_PROXY` | Number of trusted reverse-proxy hops in front of the API (Compose sets one for Nginx) |
| `WEB_ORIGIN`, `APP_URL` | Allowed browser origin and reset-link URL |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Password-reset mail delivery |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Secure media and profile image uploads |
| `DAILY_API_KEY` | Private Daily.co room and short-lived meeting token creation |
| `SEED_PASSWORD` | Development seed-account password; never use the default in a deployed environment |

The app remains usable for non-provider features without Cloudinary, Daily.co, or SMTP credentials. A request that needs a missing provider returns a clear configuration error. Uploads, live room creation, and password-reset email delivery require their provider settings.

The API exposes separate liveness and database-backed readiness checks. Login, registration, and password-reset routes have per-process rate limits; deployments with multiple API replicas should configure a shared rate-limit store to enforce limits across instances. Set `TRUST_PROXY` to the exact number of trusted proxy hops so rate limits use the client address without trusting arbitrary forwarded headers. Production requires HTTPS `WEB_ORIGIN` and `APP_URL`. Newly registered student accounts require administrator verification of department and study level before course, learning-material, quiz, or class APIs grant access.

The cohort-verification migration places existing and newly registered student accounts in pending review. Administrators can correct student department/level details and approve verification from Administration → People & access. Seed accounts and accounts created by an administrator are verified.

## Application capabilities

- Student registration and sign-in, role-aware access, profile editing, password change, and SMTP password reset
- Student, lecturer, and admin roles; department and level-aware course access; admin user/course management
- Slides and study-resource search, course/level filtering, bookmarking, uploads, and admin approval
- Past exam-paper upload and filtering, admin approval, and per-student studied-state tracking
- Lecturer quiz authoring (multiple choice, true/false, and short answer), private answer keys, timed attempts, scoring, answer review after a lecturer closes the quiz, attempt history, and leaderboard
- Class scheduling, private Daily.co room tokens, embedded live class access, persistent Socket.IO chat, and shared recording links
- Department-filtered announcements, comments, reactions, and live in-app notification badges
- Responsive desktop sidebar and mobile bottom navigation, keyboard-focus styles, reduced-motion support, and theme toggle
- Installable PWA shell/static-asset caching. Authenticated API responses are never cached for offline use.

## API testing

[openapi.yaml](./openapi.yaml) describes the REST API and bearer-token authentication. Import it into Postman, Insomnia, or another OpenAPI-compatible client. Sign in at `/api/auth/login`, then send the returned token as `Authorization: Bearer <token>`.

## Database commands

```sh
npm run db:generate       # Generate the Prisma client
npm run db:migrate        # Apply/create a development migration
npm run db:migrate:deploy # Apply checked-in migrations in deployment
npm run db:seed            # Add realistic development courses and accounts
npm run db:studio          # Open Prisma Studio
```

## Quality checks

```sh
npm run typecheck
npm run build
npm test
```

## Deployment notes

- Configure a strong, unique `JWT_SECRET`, production PostgreSQL URL, HTTPS origin, initial-admin credentials, and production SMTP, Cloudinary, and Daily.co credentials in the deployment secret manager.
- Build and run the API and web targets from the root Dockerfile, or deploy the Vite `apps/web/dist` output to a static host and the Express API separately. Set `VITE_API_URL` and `VITE_SOCKET_URL` at web build time when serving them on different origins.
- Run `npm run db:migrate:deploy` as a release step (the Compose API target runs it at startup) and never run `db:migrate` against production.
- Bootstrap the first administrator with `npm run admin:bootstrap` using one-time credentials supplied through the deployment environment. Do not run `npm run db:seed` in production; it is blocked when `NODE_ENV=production`.
- Restrict network access to PostgreSQL. Terminate HTTPS at the hosting ingress/reverse proxy and set `WEB_ORIGIN` and `APP_URL` to the public HTTPS address.
- Daily.co room creation and participant joining are integrated. Lecturers can attach a hosted recording URL when they end the class; recording capture/hosting must be enabled and configured with the chosen Daily.co plan.
- Seed users are for local development only. Do not run the seed against a production database.
