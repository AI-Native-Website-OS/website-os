[中文](README.md) | [English](README.en.md)

# AI_Native_Website_OS

# Redefining the Website with AI

The **AI-native enterprise website operating system** built for the age of AI search

A CMS at its core, AI as its engine, SEO / GEO as the gateway to traffic, and Growth as its monetization capability. For the first time, a corporate website satisfies all four at once — **humans can understand it, search engines can interpret it, AI can cite it, and the business can generate leads.**

## Highlights

- ✨ **AI-native**: Built-in RAG knowledge-base Q&A, streaming output, long-term memory, and sensitive-word filtering — usable out of the box
- 🔍 **Behavior-driven leads**: Fully automated from browsing path → dwell time → interest tags → lead scoring
- 🌐 **Bilingual (Chinese/English) + SEO/GEO**: Built-in keyword and FAQ generation, with structured data support
- 🛡 **Self-controlled data**: Fully open-source stack, private deployment, with zero third-party SaaS dependencies
- 🎨 **Unified admin console**: Content, users, permissions, dashboards, AI configuration, and SEO configuration — all in one place
- 🚀 **Production-ready**: Already serving multiple B2B customers in production; v1.3 is fully complete

## Features

### 📝 Content Management

- Multiple content types: products / solutions / case studies / resources / articles, etc.
- Markdown rich-text editing with WYSIWYG
- Categories, ordering, cover images, and SEO fields
- Scheduled publishing and version rollback

### 🤖 AI Consultant

- LLM-based conversational assistant supporting OpenAI / Claude / Qwen / DeepSeek and other models
- RAG knowledge-base retrieval grounded in the company's private knowledge
- Sensitive-word filtering and auditing
- Streaming output (SSE) + long-term memory
- Intent recognition and multi-turn conversations

### 👁 User Behavior Tracking

- Event tracking for page views, content dwell time, button clicks, file downloads, and more
- Session-level user profiles and interest tags
- Automated lead trigger rules (dwell time, visit depth, key pages)
- Behavior path replay

### 🎯 Lead Management

- Unified form intake (inquiry, download, sign-up, subscription)
- Smart de-duplication (phone / email / IP + device fingerprint)
- Automatic IP / city location detection
- Source tracking (UTM, Referrer, keywords)
- Score merging (behavior score + form score + tag score)
- One-click export to Excel

### 🛠 Admin Console

- Data dashboards (PV / UV / leads / conversion funnel)
- RBAC permission management (roles / menus / data permissions)
- Content, leads, users, AI configuration, and SEO/GEO configuration
- Chinese/English language switching


### Live Demo

- Demo URL: https://website-os.testsnlh.top:33000/
- Username: admin-test
- Password: 123456

## Tech Stack

| Layer | Technology |
|------|------|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| Backend | Java + Spring Boot 2.7 + MyBatis Plus + PostgreSQL 18 + Redis 7 |
| AI Service | Python + FastAPI + pgvector |


## Quick Start

> Prerequisites: Java 8+ & Maven, Node.js >= 24.16 & npm, Python 3.12+, and Docker (only for running PostgreSQL + Redis).

### 1. Start the database and Redis (Docker)

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

The default configuration works as-is (the schema is initialized automatically on the backend's first start).

### 3. Start the three services

```bash
# Backend (:8080)
cd backend && mvn spring-boot:run

# AI service (:8000)
cd AI_consultant && pip install -r ..\requirements.txt && python run.py

# Frontend (:3200)
cd frontend && npm ci && npm run dev
```

### 4. Access the services

| Service | URL |
| ------ | ----------------------- |
| Website home | <http://localhost:3200> |
| Backend API | <http://localhost:8080> |
| AI service | <http://localhost:8000> |

Default super admin: `admin` / `admin123`.

## Roadmap

| Phase | Theme | Scope | Status |
|------|------|----------|------|
| v1.0 | Website foundation | CMS content management, responsive multi-device portal, RBAC permissions, Chinese/English | ✅ Done |
| v1.1 | AI consultant | RAG knowledge-base Q&A, sensitive-word filtering, streaming output, long-term memory, intent recognition | ✅ Done |
| v1.2 | Marketing & lead gen | Behavior tracking, lead capture/de-duplication/scoring/export, data dashboards | ✅ Done |
| v1.3 | SEO / GEO | Keyword and FAQ generation, structured data | ✅ Done |
| v2.0 | Deployment experience | One-command Docker Compose orchestration, production deployment docs, live demo | 🚧 In progress |
| v2.1 | Performance & extensibility | Frontend component refactoring, static snapshot generation | ⏳ Planned |
| v2.2 | AI enhancements | Multi-model support (OpenAI/Claude/Qwen, etc.), agent-based automated follow-up, lead-scoring tuning | ⏳ Planned |
| v2.3 | Open capabilities | Open API + Webhooks, custom form/content types, pluggable theme templates | ⏳ Planned |

> Contributions to the roadmap via Issue / PR are welcome — it evolves with community feedback.

## Risk List

The project's currently identified security risks, technical risks, data risks, operational risks, and other potential risks are documented in:

> 📋 **[Project Risk List](RISKLIST.en.md)**

The risk list will be continuously maintained and updated throughout the project's development, testing, deployment, and operation.

## Contributing

We welcome contributions of all kinds! Please read [CONTRIBUTING.md](CONTRIBUTING.en.md) for the detailed process.

## Community & Contact

| Channel | Link |
| -------- | ------------------------------------------------------------------ |
| 🐛 Issue | [GitHub Issues](https://github.com/sinounion/ai-website-os/issues) |
| 💌 Inquiries & partnerships | jessica@sinounited.com.cn |
| 🏢 Company website | https://www.snlh.cn/ |

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

Copyright © 2024-2026 Sinounion Technology (Jiangsu) Co., Ltd.

If this project helps you, please give us a ⭐️ Star!
[⬆ Back to top](#ai_native_website_os)
