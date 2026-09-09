[中文](README.md) | [English](README.en.md)

# AI_Native_Website_OS（AI 原生网站操作系统）

AI 企业官网开源模板，集成内容管理、AI 智能顾问、用户行为追踪与智能线索的全栈企业门户，开箱即用，可直接部署与二次开发。

## 功能特性

- **内容管理** — 产品 / 解决方案 / 案例 / 资源 / 文章等，Markdown 富文本编辑、分类排序、封面图
- **AI 智能顾问** — 基于 LLM 的对话式助手，知识库 RAG 检索、敏感词过滤、流式展示、长期记忆
- **用户行为追踪** — 页面访问、内容停留、下载等行为记录，自动化线索触发
- **线索管理** — 统一表单、防重复、IP/城市归属地、来源追踪、评分合并、Excel 导出
- **管理后台** — 数据看板、权限、内容、线索、AI 配置、SEO/GEO、中英双语
![Demo.png](Demo.png)
## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| 后端 | Java + Spring Boot 2.7 + MyBatis Plus + PostgreSQL 18 + Redis 7 |
| AI 服务 | Python + FastAPI + pgvector |


## 快速启动

> 前置要求：Java 8+ & Maven、Node.js >= 24.16 & npm、Python 3.12+、Docker（仅用于启动 PostgreSQL + Redis）。

### 1. 启动数据库与 Redis（Docker）

```bash
docker run -d --name pg \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=Root@123 -e POSTGRES_DB=sinounion \
  -p 15432:5432 pgvector/pgvector:pg18

docker run -d --name redis \
  -p 16379:6379 redis:8.8.0 \
  redis-server --requirepass sinodata
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

默认配置即可直接启动（表结构会在后端首次启动时自动初始化）。

### 3. 启动三个服务

```bash
# 后端（:8080）
cd backend && mvn spring-boot:run

# AI 服务（:8000）
cd AI_consultant && pip install -r ..\requirements.txt && uvicorn api:app --host 0.0.0.0 --port 8000

# 前端（:3200）
cd frontend && npm ci && npm run dev
```

### 4. 访问服务

| 服务 | 地址 |
|------|------|
| 官网首页 | <http://localhost:3200> |
| 后端 API | <http://localhost:8080> |
| AI 服务 | <http://localhost:8000> |

默认超级管理员：`admin` / `admin123`。

## Roadmap

| 阶段 | 主题 | 规划内容 | 状态 |
|------|------|----------|------|
| v1.0 | 官网基础 | CMS 内容管理、多端自适应门户、RBAC 权限、中英双语 | ✅ 已完成 |
| v1.1 | AI 顾问 | RAG 知识库问答、敏感词过滤、流式输出、长期记忆、意图识别 | ✅ 已完成 |
| v1.2 | 营销获客 | 行为追踪、线索采集/查重/评分/导出、数据看板 | ✅ 已完成 |
| v1.3 | SEO / GEO | 关键词与 FAQ 生成、结构化数据 | ✅ 已完成 |
| v2.0 | 部署体验 | Docker Compose 一键编排、生产环境部署文档、Demo 在线体验 | 🚧 进行中 |
| v2.1 | 性能与扩展 | 前端组件化重构、静态快照生成 | ⏳ 规划中 |
| v2.2 | AI 增强 | 多模型接入（OpenAI/Claude/通义等）、Agent 化自动跟进、线索智能评分调优 | ⏳ 规划中 |
| v2.3 | 开放能力 | 开放 API + Webhook、表单/内容类型自定义、插件化主题模板 | ⏳ 规划中 |

> 欢迎通过 Issue / PR 参与规划，Roadmap 会随社区反馈动态调整。

## License

Apache License — 详见 [LICENSE](LICENSE.txt)。