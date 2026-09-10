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
# 将 <DB_PASSWORD> / <REDIS_PASSWORD> 替换为第 2 步在 .env 中配置的密码
docker run -d --name pg \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=<DB_PASSWORD> -e POSTGRES_DB=sinounion \
  -p 15432:5432 pgvector/pgvector:pg18

docker run -d --name redis \
  -p 16379:6379 redis:8.8.0 \
  redis-server --requirepass <REDIS_PASSWORD>
```

> 数据库与 Redis 密码需在 `.env` 中自行配置（见第 2 步），并须与 Docker 口令保持一致；生产/公网环境请使用强随机口令。

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：配置 `DB_PASSWORD` / `SPRING_DATASOURCE_PASSWORD` / `REDIS_PASSWORD` / `SPRING_REDIS_PASSWORD` 四项密码（保持一致并匹配 Docker 口令），并将 `JWT_SECRET` 替换为强随机密钥。其余默认配置即可直接启动（表结构会在后端首次启动时自动初始化）。完整变量说明见下文「环境变量说明」。

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

## 环境变量说明

所有环境变量通过根目录 `.env` 文件配置（后端与 AI 服务启动时自动加载），完整示例见 `.env.example`。主要配置项如下：

### 必配项（缺失将无法正常启动）

| 变量 | 作用 |
|---|---|
| `SPRING_APPLICATION_NAME` | 应用名（服务注册 / 日志标识） |
| `SERVER_PORT` | 后端 HTTP 端口 |
| `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | 后端 PostgreSQL 数据源（密码须与 `DB_PASSWORD` 一致） |
| `SPRING_REDIS_HOST` / `SPRING_REDIS_PORT` / `SPRING_REDIS_PASSWORD` / `SPRING_REDIS_DATABASE` | 后端 Redis 连接（密码须与 `REDIS_PASSWORD` 一致，未设密码留空） |
| `JWT_SECRET` | JWT 签名密钥（生产务必使用强随机字符串） |
| `JWT_EXPIRATION` | JWT 有效期（毫秒，`86400000` = 24 小时） |
| `UPLOAD_PATH` / `UPLOAD_ALLOWED_TYPES` | 上传文件保存目录 / 允许上传的 MIME 类型 |
| `AI_SERVICE_URL` / `AI_SERVICE_MEMORIES_DIR` | AI 服务地址 / AI 对话记忆（历史存档）目录 |
| `APP_FRONTEND_PUBLIC_DIR` / `APP_CONFIG_FILE_PATH` | 前端 SEO 输出目录 / 管理后台在线编辑的配置文件路径 |

### 密码一致性要求

数据库与 Redis 各存在「AI 服务」和「后端 API」两套变量，密码必须保持一致：

- PostgreSQL：`DB_PASSWORD`（AI 服务）= `SPRING_DATASOURCE_PASSWORD`（后端）
- Redis：`REDIS_PASSWORD`（AI 服务）= `SPRING_REDIS_PASSWORD`（后端），且均须与 Docker 启动口令匹配

### 选配项（按需调整）

| 变量 | 作用 |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` | AI 服务直连 PostgreSQL 的连接信息（默认 `localhost:15432` / `sinounion` / `root`） |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_DB` | AI 服务直连 Redis 的连接信息（默认 `localhost:16379` / `0`） |
| `FRONTEND_PORT` | 前端本地开发 / 静态托管端口 |
| `FRONTEND_API_BASE_URL` | 前端构建时注入的后端直连地址（浏览器直连后端端口以获取真实访客 IP） |
| `BACKEND_BASE_URL` | AI 服务本地读不到上传文件时兜底拉取的后端地址 |
| `APP_TRUST_PROXY_IP_HEADER` | 是否信任反向代理透传的 `X-Real-IP` / `X-Forwarded-For` 头（浏览器直连后端时应为 `false`，防伪造） |
| `APP_IP_LOCATION_PROVIDER` | IP 归属地解析方式：`offline`（离线 ip2region）/ `ipwho`（在线）/ `auto`（在线优先、失败回退离线） |
| `APP_IPWHO_URL` / `APP_IPWHO_TIMEOUT_MS` | 在线归属地服务地址 / 请求超时（毫秒） |
| `CONFIG_CRYPTO_AES_KEY` | 敏感配置落盘 AES 密钥（Base64 32 字节；未配置时自动生成，生产建议显式设置） |
| `AI_SYSTEM_PROMPT` | AI 顾问人设与回答约束提示词（可在管理后台覆盖） |
| `AI_UPLOAD_PATH` | AI 服务媒体文件根目录（相对项目根目录，用于图片 / 附件文档向量化） |

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

## 风险清单

项目当前已识别的安全风险、技术风险、数据风险、运维风险及其他潜在风险，详见：

> 📋 **[项目风险清单](RISKLIST.md)**
> 
风险清单将根据项目开发、测试、部署及运行情况持续维护和更新。

## License

Apache License — 详见 [LICENSE](LICENSE)。