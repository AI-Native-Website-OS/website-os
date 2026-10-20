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


## Local Deployment - Quick Start

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
## Docker Deployment - Quick Start
Docker Containerized Deployment — see [README.md](./docker/README.en.md) for details.

### 4. Access the services

| Service | URL |
| ------ | ----------------------- |
| Website home | <http://localhost:3200> |

Default super admin: `admin` / `admin123`.

## Roadmap

| Phase | Theme | Scope | Status |
|--------|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------|
| v1.0.0 | Website foundation | Public website: home, products, solutions, customer cases, resource center, about us, FAQ, contact us, user center; AI consultant: streaming chat, image recognition; SEO metadata and sitemap; PV/UV and user behavior tracking; admin: dashboard, users/roles/permissions, content management, AI management, lead management, statistics management, settings; AI consultant service: multi-model, RAG/Rerank, multimodal, intent recognition, prohibited-content detection, user memory | ✅ Done |
| v1.0.1 | Experience improvements | Dynamic page titles, mobile footer adaptation, backend configuration for homepage footer / contact icons / core modules / case statistics, detail image upload, AI first-response and chat-record consistency, rate limiting (5 for guests / 30 per minute for logged-in users), 20-message context retention, AI response coherence, lead merging, online SEO/GEO editing in admin, upload type and size limits | ✅ Done |
| v2.0.0 | Pre-open-source and official open-source release | Swagger permission control, SonarQube issue cleanup, internal information removal and white-labeling, 16 features including editable logo / SMS login / Chinese-English bilingual, 4 bug fixes, content and bilingual documentation; open-source engineering: GitHub org/repos, README/LICENSE/CONTRIBUTING, Issue/PR templates, release process, backup and upgrade plan; governance and monetization: Community/Pro/SaaS/Enterprise boundaries, license/trademark/plugin agreements, contributor incentives; launch: three-edition comparison page, open-source entry, articles/videos, roadmap, pilot recruitment | ✅ Done |
| v2.0.1 | Feature iteration and bug fixes | Fixes for login popup, online preview/download, thinking-process toggle, resource center filtering, homepage case count, image display, mobile menu overlay; English auto-translation and English answers; guest quota of 30, AI knowledge-base accuracy, super admin memory, welcome message/prompt styling; editable main categories, case categories and ordering, three-level menu ordering, content list loading, admin bell notifications; footer/contact QR code, notification popup, friend links; Docker deployment | ✅ Done |
| v2.0.2 | Community edition refinement | AI testing and bug fixes, security risk governance, SEO/GEO optimization, data permission management, database cleanup and backup, content version history, frontend/backend code simplification and refactoring, removal of redundant APIs and deprecated features, exception handling and interaction experience optimization, automated testing and CI quality gates, open-source deployment and documentation | ⏳ Planned |
| v2.1.0 | Extended community edition | Add website shopping-guide / pre-sales / customer-service / content agents; add CRM integration | ⏳ Planned |
| v2.2.0 | Extended professional edition | Multi-site / multi-domain / sub-sites | ⏳ Planned |
| v2.3.0 | Extended SaaS edition | Online sign-up/trial; AI website builder (generate a site automatically from company materials); cloud hosting, domains, publishing; plans and billing; AI operations and data analytics | ⏳ Planned |

> Contributions to the roadmap via Issue / PR are welcome — it evolves with community feedback.

## Risk List

The project's currently identified security risks, technical risks, data risks, operational risks, and other potential risks are documented in:

> 📋 **[Project Risk List](RISKLIST.en.md)**
>
> The risk list will be continuously maintained and updated throughout the project's development, testing, deployment, and operation.

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
