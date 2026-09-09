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
docker run -d --name pg \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=Root@123 -e POSTGRES_DB=sinounion \
  -p 15432:5432 pgvector/pgvector:pg18

docker run -d --name redis \
  -p 16379:6379 redis:8.8.0 \
  redis-server --requirepass sinodata
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

The default configuration works out of the box (tables are initialized automatically on the backend's first startup).

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

## License

Apache License — see [LICENSE](LICENSE.txt).
