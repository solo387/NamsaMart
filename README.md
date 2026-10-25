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

For a containerized application, copy `.env.example` to `.env`, replace the example secrets, then run:

```sh
docker compose up --build -d
docker compose exec api npm run db:seed
```

Open [http://localhost:8080](http://localhost:8080). Compose applies checked-in Prisma migrations before the API starts. PostgreSQL data persists in the `postgres_data` volume. The API is also available on port 4000. `docker compose down` stops services; `docker compose down -v` also deletes local database data.

The root `Dockerfile` provides an API target and a static Nginx PWA target. Nginx serves the SPA with history fallback and proxies API and Socket.IO traffic to the API container.

## Environment variables

See [.env.example](./.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by local development and Prisma |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Compose database configuration |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Signing key and lifetime for access tokens |
| `WEB_ORIGIN`, `APP_URL` | Allowed browser origin and reset-link URL |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Password-reset mail delivery |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Secure media and profile image uploads |
| `DAILY_API_KEY` | Private Daily.co room and short-lived meeting token creation |
| `SEED_PASSWORD` | Development seed-account password; never use the default in a deployed environment |

The app remains usable for non-provider features without Cloudinary, Daily.co, or SMTP credentials. A request that needs a missing provider returns a clear configuration error. Uploads, live room creation, and password-reset email delivery require their provider settings.

The API exposes separate liveness and database-backed readiness checks. Authentication routes have additional per-process rate limits; deployments with multiple API replicas should configure a shared rate-limit store to enforce limits across instances.

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

- Configure a strong, unique `JWT_SECRET`, production PostgreSQL URL, HTTPS origin, and production SMTP, Cloudinary, and Daily.co credentials in the deployment secret manager.
- Build and run the API and web targets from the root Dockerfile, or deploy the Vite `apps/web/dist` output to a static host and the Express API separately. Set `VITE_API_URL` and `VITE_SOCKET_URL` at web build time when serving them on different origins.
- Run `npm run db:migrate:deploy` as a release step (the Compose API target runs it at startup) and never run `db:migrate` against production.
- Restrict network access to PostgreSQL. Terminate HTTPS at the hosting ingress/reverse proxy and set `WEB_ORIGIN` and `APP_URL` to the public HTTPS address.
- Daily.co room creation and participant joining are integrated. Lecturers can attach a hosted recording URL when they end the class; recording capture/hosting must be enabled and configured with the chosen Daily.co plan.
- Seed users are for local development only. Do not run the seed against a production database.
