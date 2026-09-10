[中文](README.md) | [EN](README.en.md)

# AI_Native_Website_OS

An open-source template for AI-native corporate websites: a full-stack enterprise portal that ships with content management, an AI consultant, user behavior tracking, and intelligent lead generation. Ready to run out of the box — deploy directly or extend it further.

## Features

- **Content Management** — Products / Solutions / Case Studies / Resources / Articles with Markdown rich-text editing, categorization, ordering, and cover images
- **AI Consultant** — LLM-powered conversational assistant with RAG knowledge-base retrieval, sensitive-word filtering, streaming output, and long-term memory
- **User Behavior Tracking** — Records page views, content dwell time, downloads, etc., with automated lead triggers
- **Lead Management** — Unified forms, deduplication, IP/geo attribution, source tracking, lead scoring & merging, Excel export
- **Admin Dashboard** — Data dashboards, permissions, content, leads, AI configuration, SEO/GEO, and built-in Chinese/English localization
![Demo.png](Demo.png)

## Tech Stack

| Layer     | Technology                                                     |
|-----------|----------------------------------------------------------------|
| Frontend  | Next.js 15 + React 19 + TypeScript + Tailwind CSS              |
| Backend   | Java + Spring Boot 2.7 + MyBatis Plus + PostgreSQL 18 + Redis 7 |
| AI        | Python + FastAPI + pgvector                                    |

## Quick Start

> Prerequisites: Java 8+ & Maven, Node.js >= 24.16 & npm, Python 3.12+, Docker (only needed to run PostgreSQL + Redis).

### 1. Start database & Redis (Docker)

```bash
# Replace <DB_PASSWORD> / <REDIS_PASSWORD> with the passwords configured in .env (step 2)
docker run -d --name pg \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=<DB_PASSWORD> -e POSTGRES_DB=sinounion \
  -p 15432:5432 pgvector/pgvector:pg18

docker run -d --name redis \
  -p 16379:6379 redis:8.8.0 \
  redis-server --requirepass <REDIS_PASSWORD>
```

> PostgreSQL and Redis passwords must be configured in `.env` yourself (see step 2) and must match the Docker containers; use strong random passwords on public/production environments.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`: set `DB_PASSWORD` / `SPRING_DATASOURCE_PASSWORD` / `REDIS_PASSWORD` / `SPRING_REDIS_PASSWORD` (keep all four consistent and matching the Docker passwords), and replace `JWT_SECRET` with a strong random key. The rest of the default configuration works out of the box (tables are initialized automatically on the backend's first startup). See "Environment Variables" below for the full list.

### 3. Start the three services

```bash
# Backend (:8080)
cd backend && mvn spring-boot:run

# AI service (:8000)
cd AI_consultant && pip install -r ..\requirements.txt && uvicorn api:app --host 0.0.0.0 --port 8000

# Frontend (:3200)
cd frontend && npm ci && npm run dev
```

### 4. Access the services

| Service       | URL                          |
|---------------|------------------------------|
| Website       | http://localhost:3200        |
| Backend API   | http://localhost:8080        |
| AI service    | http://localhost:8000        |

Default super admin: `admin` / `admin123`.

## Environment Variables

All environment variables are configured in the root `.env` file (auto-loaded by the backend and the AI service on startup). See `.env.example` for a complete template. Main settings:

### Required (the app will not start without these)

| Variable | Purpose |
|---|---|
| `SPRING_APPLICATION_NAME` | Application name (service registration / log identifier) |
| `SERVER_PORT` | Backend HTTP port |
| `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | Backend PostgreSQL datasource (password must match `DB_PASSWORD`) |
| `SPRING_REDIS_HOST` / `SPRING_REDIS_PORT` / `SPRING_REDIS_PASSWORD` / `SPRING_REDIS_DATABASE` | Backend Redis connection (password must match `REDIS_PASSWORD`; leave empty if none) |
| `JWT_SECRET` | JWT signing key (use a strong random string in production) |
| `JWT_EXPIRATION` | JWT lifetime in milliseconds (`86400000` = 24 hours) |
| `UPLOAD_PATH` / `UPLOAD_ALLOWED_TYPES` | Upload storage directory / allowed MIME types |
| `AI_SERVICE_URL` / `AI_SERVICE_MEMORIES_DIR` | AI service URL / AI conversation memory (history archive) directory |
| `APP_FRONTEND_PUBLIC_DIR` / `APP_CONFIG_FILE_PATH` | Frontend SEO output directory / config file path editable from the admin UI |

### Password consistency requirements

PostgreSQL and Redis each have two sets of variables — one for the AI service direct connection and one for the backend Spring config — and the passwords must match:

- PostgreSQL: `DB_PASSWORD` (AI direct) = `SPRING_DATASOURCE_PASSWORD` (Spring)
- Redis: `REDIS_PASSWORD` (AI direct) = `SPRING_REDIS_PASSWORD` (Spring), and both must match the Docker startup password

### Optional (adjust as needed)

| Variable | Purpose |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` | PostgreSQL connection info for the AI service direct connection (default `localhost:15432` / `sinounion` / `root`) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` | Redis connection info for the AI service direct connection (default `localhost:16379` / `0`) |
| `FRONTEND_PORT` | Frontend port for local dev / static hosting |
| `FRONTEND_API_BASE_URL` | Backend URL injected at frontend build time (browsers connect directly to the backend port to get the real visitor IP) |
| `BACKEND_BASE_URL` | Backend URL the AI service falls back to when it cannot read uploaded files locally |
| `APP_TRUST_PROXY_IP_HEADER` | Whether to trust `X-Real-IP` / `X-Forwarded-For` from a reverse proxy (set `false` when browsers hit the backend directly, to prevent IP spoofing) |
| `APP_IP_LOCATION_PROVIDER` | IP geolocation provider: `offline` (ip2region) / `ipwho` (online) / `auto` (online first, offline fallback) |
| `APP_IPWHO_URL` / `APP_IPWHO_TIMEOUT_MS` | Online geolocation service URL / request timeout (ms) |
| `CONFIG_CRYPTO_AES_KEY` | AES key for encrypting sensitive config at rest (Base64 32 bytes; auto-generated if unset, set explicitly in production) |
| `AI_SYSTEM_PROMPT` | AI consultant persona and answer constraints (overridable in the admin UI) |
| `AI_UPLOAD_PATH` | AI service media root directory (relative to project root, used for image/attachment vectorization) |

## Roadmap

| Phase | Topic          | Planned Content                                        | Status        |
|-------|----------------|--------------------------------------------------------|---------------|
| v1.0  | Website Core   | CMS content management, responsive portal, RBAC permissions, Chinese/English localization | ✅ Done     |
| v1.1  | AI Consultant  | RAG knowledge-base Q&A, sensitive-word filtering, streaming output, long-term memory, intent recognition | ✅ Done     |
| v1.2  | Marketing & Leads | Behavior tracking, lead capture/dedupe/scoring/export, data dashboards | ✅ Done |
| v1.3  | SEO / GEO      | Keyword & FAQ generation, structured data               | ✅ Done     |
| v2.0  | Deployment     | Docker Compose one-click orchestration, production deployment docs, online Demo | 🚧 In progress |
| v2.1  | Performance & Scale | Frontend componentization refactor, static snapshot generation | ⏳ Planned |
| v2.2  | AI Enhancements| Multi-model support (OpenAI/Claude/Qwen, etc.), agent-based auto follow-up, smarter lead scoring | ⏳ Planned |
| v2.3  | Open Platform  | Open API + Webhooks, custom forms/content types, pluggable theme templates | ⏳ Planned |

> Feedback via Issues/PRs is welcome — the Roadmap evolves based on community input.

## Risk List

The project's currently identified security risks, technical risks, data risks, operational risks, and other potential risks are documented in:

> 📋 **[Project Risk List](RISKLIST.en.md)**

The risk list will be continuously maintained and updated throughout the project's development, testing, deployment, and operation.

## License

Apache License — see [LICENSE](LICENSE).
