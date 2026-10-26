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

### Deploy the API to Cloud Run

The API image has a dedicated [Dockerfile.cloudrun](./Dockerfile.cloudrun); it builds only the shared package and API, listens on the `PORT` supplied by Cloud Run, and does not run database migrations every time an instance starts. The Cloud Run service and migration job both use the same release image. This guide uses Cloud Build and Artifact Registry, so Docker does not need to be installed on the deployer machine.

Before deployment, choose a Google Cloud project and region, enable billing and the Cloud Run, Cloud Build, Artifact Registry, and Secret Manager APIs, create an Artifact Registry Docker repository, and provision a managed PostgreSQL database. Use a database URL that is reachable from Cloud Run and requires TLS; store it as the `database-url` Secret Manager secret. Do not put production database credentials in source control or the container image. Grant the Cloud Run service identity permission to access the secrets it uses.

Set the exact Firebase Hosting origin as `WEB_ORIGIN` and `APP_URL` (for example, `https://your-firebase-project-id.web.app`; use the custom domain after it is connected). Store a random, unique, at-least-32-character `JWT_SECRET` in Secret Manager as `jwt-secret`. Set optional SMTP, Cloudinary, and Daily.co settings in the Cloud Run service configuration or Secret Manager as appropriate.

From the repository root, substitute your own Google Cloud project ID, region, and Firebase Hosting origin. The example values below are intentionally placeholders:

```sh
PROJECT_ID="your-google-cloud-project-id"
REGION="us-central1"
WEB_ORIGIN="https://your-firebase-project-id.web.app"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create namsamart --repository-format=docker --location="$REGION"

gcloud builds submit --config cloudbuild.api.yaml --substitutions=_REGION="$REGION" .
```

Grant the Cloud Build service account `roles/artifactregistry.writer` on the repository. Create Secret Manager versions for `database-url` and `jwt-secret` using the production PostgreSQL URL and JWT secret. The database URL should require TLS and include `connection_limit=5` (for example, append `&connection_limit=5` if it already has query parameters). Grant the Cloud Run runtime identity `roles/secretmanager.secretAccessor` for these secrets. Then set `IMAGE` to the image URI printed by Cloud Build (`$REGION-docker.pkg.dev/$PROJECT_ID/namsamart/api:<build-id>`) and run the migration as a one-off Cloud Run Job before deploying the API:

```sh
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/namsamart/api:BUILD_ID_FROM_CLOUD_BUILD"

gcloud run jobs deploy namsamart-migrate \
  --image "$IMAGE" \
  --region "$REGION" \
  --command npm \
  --args run,db:migrate:deploy,--workspace,@namsamart/api \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database-url:latest
gcloud run jobs execute namsamart-migrate --region <region> --wait
```

Create Secret Manager versions for the Cloudinary cloud name, API key, and API secret if lecturers will upload materials, past papers, or avatars. The application returns a clear configuration error for uploads if these are absent. Map the secret values to `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the API service. Enable PDF delivery in the Cloudinary product security settings so uploaded PDFs can be embedded for preview. PDFs are uploaded as Cloudinary image assets for browser rendering; PowerPoint and Word files remain downloadable raw assets. Uploads are limited to 25 MB to stay within Cloud Run's HTTP request size limit while the API buffers each file for provider upload.

For live classes, create a Daily.co account and copy its API key from the Daily developer dashboard. Store it in Secret Manager as `daily-api-key`, and grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor` on that secret. Map it to `DAILY_API_KEY` on the API service as shown below. Keep this key server-side; do not put it in a `VITE_*` variable or the frontend build. Without it, classes can be scheduled, but starting a room and joining a live class return a configuration error.

```sh
gcloud secrets create daily-api-key --replication-policy=automatic
printf '%s' "$DAILY_API_KEY" | gcloud secrets versions add daily-api-key --data-file=-
```

The API uses Daily.co to create private rooms and short-lived lecturer/student meeting tokens. Recording capture is not started or saved automatically: enable recording for the Daily.co account/plan, then provide a hosted recording URL when ending the class.

Deploy the service with Socket.IO connection settings suitable for the current in-memory realtime implementation:

```sh
gcloud run deploy namsamart-api \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --session-affinity \
  --max 1 \
  --memory 1Gi \
  --set-env-vars NODE_ENV=production,TRUST_PROXY=1,WEB_ORIGIN="$WEB_ORIGIN",APP_URL="$WEB_ORIGIN" \
  --set-secrets DATABASE_URL=database-url:latest,JWT_SECRET=jwt-secret:latest,CLOUDINARY_CLOUD_NAME=cloudinary-cloud-name:latest,CLOUDINARY_API_KEY=cloudinary-api-key:latest,CLOUDINARY_API_SECRET=cloudinary-api-secret:latest,DAILY_API_KEY=daily-api-key:latest
```

If Cloudinary or Daily.co is not configured yet, omit the corresponding secret mappings for the service to start. Material/avatar uploads or live-room creation/joining will remain unavailable, respectively, until the secrets are added and a new Cloud Run revision is deployed.

The service must be publicly invokable because browsers call the API directly; application data remains protected by the app's JWT authentication and role/cohort checks. `--session-affinity` helps keep Socket.IO connections on one instance, and `--max 1` avoids splitting the current in-memory Socket.IO rooms and per-process rate limits across Cloud Run instances. This is a deliberate initial capacity limit, not a high-availability or scale-out configuration. Before increasing it, add a shared Socket.IO adapter (for example Redis) and a shared rate-limit store. Cloud Run WebSockets are subject to the configured request timeout and can disconnect; clients must reconnect.

Use the resulting Cloud Run HTTPS service URL to set `VITE_API_URL=<service-url>/api` and `VITE_SOCKET_URL=<service-url>` in `apps/web/.env.production`, then follow the Firebase Hosting deployment steps above. Set the API `WEB_ORIGIN` and `APP_URL` to the exact Hosting origin. Deploy future schema changes by executing the migration job against the new release image before routing production traffic to that image.

Bootstrap the first administrator with a separate one-off Cloud Run Job. Store `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` in Secret Manager, grant the job identity access to those secrets, then deploy and execute the job:

```sh
gcloud run jobs deploy namsamart-admin-bootstrap \
  --image "$IMAGE" \
  --region "$REGION" \
  --command npm \
  --args run,admin:bootstrap,--workspace,@namsamart/api \
  --set-secrets BOOTSTRAP_ADMIN_NAME=bootstrap-admin-name:latest,BOOTSTRAP_ADMIN_EMAIL=bootstrap-admin-email:latest,BOOTSTRAP_ADMIN_PASSWORD=bootstrap-admin-password:latest,DATABASE_URL=database-url:latest
gcloud run jobs execute namsamart-admin-bootstrap --region "$REGION" --wait
```

The bootstrap command refuses to create an administrator if one already exists. Remove or disable the one-time bootstrap secrets after successful setup.

The Cloud Run and database resources incur usage charges according to Google Cloud and database-provider pricing. Review the service, database, networking, storage, and backup costs and configure budgets before provisioning production resources.

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
- Slides and study-resource search, course/level filtering, bookmarking, uploads up to 25 MB, PDF/MP4 in-app preview, and admin approval
- Past exam-paper upload and filtering, in-app PDF preview, admin approval, and per-student studied-state tracking
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
- Run `npm run db:migrate:deploy` as a release step (the Compose API command runs it at startup; Cloud Run uses a separate one-off job) and never run `db:migrate` against production.
- Bootstrap the first administrator with `npm run admin:bootstrap` using one-time credentials supplied through the deployment environment. Do not run `npm run db:seed` in production; it is blocked when `NODE_ENV=production`.
- Restrict network access to PostgreSQL. Terminate HTTPS at the hosting ingress/reverse proxy and set `WEB_ORIGIN` and `APP_URL` to the public HTTPS address.
- Daily.co room creation and participant joining are integrated. Lecturers can attach a hosted recording URL when they end the class; recording capture/hosting must be enabled and configured with the chosen Daily.co plan.
- Seed users are for local development only. Do not run the seed against a production database.
