[中文](README.md) | [English](README.en.md)

# AI_Native_Website_OS（AI 原生网站操作系统）

# 以 AI 重新定义网站

面向 AI 搜索时代的 **AI 原生企业官网操作系统**

以 CMS 为底座，以 AI 为引擎，以 SEO / GEO 为流量入口，以 Growth 为商业化能力。 让企业官网第一次同时满足——**人能看懂、搜索引擎能理解、AI 能引用、企业能获客。**

## 核心亮点

- ✨ **AI 原生**：内置 RAG 知识库问答、流式输出、长期记忆、敏感词过滤，开箱即可用
- 🔍 **行为驱动线索**：从「浏览路径 → 停留时长 → 兴趣标签 → 线索评分」全自动
- 🌐 **中英双语 + SEO/GEO**：内置关键词与 FAQ 生成，支持结构化数据
- 🛡 **数据自主可控**：全栈开源，私有化部署，无任何第三方 SaaS 依赖
- 🎨 **管理后台一体化**：内容、用户、权限、看板、AI 配置、SEO 配置，一个后台搞定
- 🚀 **生产可用**：已服务于多个 ToB 客户生产环境，v1.3 全部完成

## 功能特性

### 📝 内容管理

- 产品 / 解决方案 / 案例 / 资源 / 文章等多类型内容
- Markdown 富文本编辑，所见即所得
- 分类、排序、封面图、SEO 字段
- 定时发布、版本回溯

### 🤖 AI 智能顾问

- 基于 LLM 的对话式助手，支持 OpenAI / Claude / 通义千问 / DeepSeek 等多模型
- RAG 知识库检索，结合企业私有知识
- 敏感词过滤与审计
- 流式输出（SSE）+ 长期记忆
- 意图识别与多轮对话

### 👁 用户行为追踪

- 页面访问、内容停留、按钮点击、文件下载等行为埋点
- 会话级用户画像与兴趣标签
- 自动化线索触发规则（停留时长、访问深度、关键页面）
- 行为路径回放

### 🎯 线索管理

- 统一表单接入（咨询、下载、注册、订阅）
- 智能查重（手机号 / 邮箱 / IP + 设备指纹）
- IP / 城市归属地自动识别
- 来源追踪（UTM、Referrer、关键词）
- 评分合并（行为分 + 表单分 + 标签分）
- 一键导出 Excel

### 🛠 管理后台

- 数据看板（PV / UV / 线索 / 转化漏斗）
- RBAC 权限管理（角色 / 菜单 / 数据权限）
- 内容、线索、用户、AI 配置、SEO/GEO 配置
- 中英双语切换


###  在线体验

- 在线体验地址： https://website-os.testsnlh.top:33000/
- 用户名：admin-test
- 密码：123456

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
cd AI_consultant && pip install -r ..\requirements.txt && python run.py

# 前端（:3200）
cd frontend && npm ci && npm run dev
```

### 4. 访问服务

| 服务     | 地址                      |
| ------ | ----------------------- |
| 官网首页   | <http://localhost:3200> |
| 后端 API | <http://localhost:8080> |
| AI 服务  | <http://localhost:8000> |

默认超级管理员：`admin` / `admin123`。

## Roadmap

| 阶段   | 主题        | 规划内容                                          | 状态     |
| ---- | --------- | --------------------------------------------- | ------ |
| v1.0 | 官网基础      | CMS 内容管理、多端自适应门户、RBAC 权限、中英双语                 | ✅ 已完成  |
| v1.1 | AI 顾问     | RAG 知识库问答、敏感词过滤、流式输出、长期记忆、意图识别                | ✅ 已完成  |
| v1.2 | 营销获客      | 行为追踪、线索采集/查重/评分/导出、数据看板                       | ✅ 已完成  |
| v1.3 | SEO / GEO | 关键词与 FAQ 生成、结构化数据                             | ✅ 已完成  |
| v2.0 | 部署体验      | Docker Compose 一键编排、生产环境部署文档、Demo 在线体验        | 🚧 进行中 |
| v2.1 | 性能与扩展     | 前端组件化重构、静态快照生成                                | ⏳ 规划中  |
| v2.2 | AI 增强     | 多模型接入（OpenAI/Claude/通义等）、Agent 化自动跟进、线索智能评分调优 | ⏳ 规划中  |
| v2.3 | 开放能力      | 开放 API + Webhook、表单/内容类型自定义、插件化主题模板           | ⏳ 规划中  |

> 欢迎通过 Issue / PR 参与规划，Roadmap 会随社区反馈动态调整。

## 风险清单

项目当前已识别的安全风险、技术风险、数据风险、运维风险及其他潜在风险，详见：

> 📋 **[项目风险清单](RISKLIST.md)**
>
> 风险清单将根据项目开发、测试、部署及运行情况持续维护和更新。

## 贡献指南

我们欢迎所有形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细流程。

## 社区与联系

| 渠道       | 链接                                                                 |
| -------- | ------------------------------------------------------------------ |
| 🐛 Issue | [GitHub Issues](https://github.com/sinounion/ai-website-os/issues) |
| 💌 咨询与合作 | jessica@sinounited.com.cn                                          |
| 🏢 公司主页  | https://www.snlh.cn/                                               |
## License

Apache License 2.0 — 详见 [LICENSE](LICENSE)。

Copyright © 2024-2026 圣诺联合科技（江苏）有限公司

如果这个项目对你有帮助，请给我们一个 ⭐️ Star！
[⬆ 回到顶部](#ai_native_website_os)