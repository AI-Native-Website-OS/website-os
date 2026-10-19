# 系统安全与缺陷风险清单

> 本清单由 AI 基于项目源代码、配置文件、接口实现及相关项目文档进行自动化分析与测试后生成，记录测试过程中识别出的潜在安全风险、功能缺陷、代码质量问题及其他风险事项。
>
> 清单中的风险结论及整改建议均来源于 AI 测试与分析结果，部分问题可能存在误报、漏报或需要结合实际运行环境进一步确认的情况。因此，本清单主要作为项目风险识别、问题排查和后续整改的参考依据，**不等同于人工安全审计、渗透测试或第三方安全认证结论**。
>
> 项目后续开发、测试及版本迭代过程中，将持续通过 AI 辅助测试与人工复核更新本清单。

## 清单说明

* **测试方式**：AI 自动化代码分析、静态检查、逻辑分析及相关测试
* **分析对象**：项目源代码、配置文件、接口及相关项目文档
* **风险范围**：安全风险、功能缺陷、代码质量、配置风险、数据风险及其他潜在问题
* **结论性质**：AI 测试与分析结论，需结合实际环境进行人工复核
* **维护方式**：随着项目版本迭代持续更新
* **状态标记**：各项以「部分修复 / 未修复 / 已变化」标注最近一次核验（当前工作区）时的状态；「部分修复」表示主路径已整改但仍有残留
* **精简原则**：已完全修复的条目将从本清单中移除（其修复记录见提交历史），以保证清单持续精简、不随版本迭代无限膨胀

> **特别说明：** 本清单用于辅助项目开发与质量管理，不构成对系统不存在安全漏洞或其他缺陷的保证。

---

## 一、凭据与机密泄露

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| A1 | `.env` 曾入库且含真实凭据 | **部分修复**：`.env` 已移出 git 跟踪并加入 `.gitignore`，`.env.example` 改为 `REPLACE_WITH_STRONG_*` 占位；**残留**：旧值仍留存于 git 历史，须视为已泄露；`docker/docker-compose.yml` 仍带弱默认口令（`DB_USER` 默认 `root`、`DB_PASSWORD` 默认 `sinounion`、`REDIS_PASSWORD` 默认 `sinoredis`） | `根 .env`、`.env.example`、`docker/docker-compose.yml:25-26,43` | 轮换全部 DB/Redis/JWT/AES 密钥并清理 git 历史；compose 强制外部注入、去除弱默认 |
| A3 | 默认超级管理员 `admin/admin123` 未强制改密 | **未修复**：bcrypt 种子口令仍在，README 公开该口令；全仓无首登强制改密标志 | `backend/src/main/resources/sinounion.sql:673-676`；`README.md:121` | 首次登录强制改密 / 部署时校验弱口令 |
| A4 | 短信"dev 兜底"明文返回验证码并落日志 | **未修复**：未配置短信时仍 `log.info` 验证码并经响应体 `devCode` 返回，可接管任意手机号账户（`send-code`/`login-by-code` 为公开端点且自动注册） | `backend/.../service/SmsService.java:77-82`；`.../controller/AuthController.java:69-73` | 生产禁用兜底回显；隔离 dev/prod profile |
| A5（关联 BUG S-03、D-13） | JWT 存 `localStorage` + 非 HttpOnly/非 Secure cookie | **部分修复**：新增 refresh token 与服务端 `tokenVersion`（改密自增，过滤器拒绝过期版本）；**残留**：access token 仍存 `localStorage`，前端 JS 写的 cookie 仍非 HttpOnly/Secure，无服务端登出/黑名单吊销接口 | `frontend/src/hooks/useAuth.tsx:43-51,66-70,104-113`；`src/lib/api.ts:14`；`src/lib/tokenRefresh.ts:21-61`；`backend/.../utils/JwtUtils.java:27-45,92-95`；`.../security/JwtAuthenticationFilter.java:51-61` | token 改 httpOnly cookie；补服务端登出/黑名单吊销 |
| B4 / S-06 | CORS 全开放且配置重复 | **未修复**：`CorsConfig` 与 `SecurityConfig` 仍是两套完全相同的配置，均 `AllowedOriginPatterns("*")` + `allowCredentials=true` | `backend/.../config/CorsConfig.java:14-26`；`backend/.../config/SecurityConfig.java:33-43` | 限定允许来源白名单；删除其中一套重复定义 |
| A9 / D-12 | `localStorage` 解析无异常兜底 | **部分修复**：`admin-layout.tsx` 已有 try/catch；`useAuth.tsx:47-50`、`useTracking.ts:69` 仍裸 `JSON.parse` | `useAuth.tsx:47-50`、`useTracking.ts:69`、`admin-layout.tsx:270-279` | 为剩余解析点增加异常兜底 |
| A6 / S-11 | 管理端 api-docs 运行时从第三方 CDN 加载 Swagger UI | **部分修复**：已为 unpkg 脚本/样式添加 `integrity`（SRI）与 `crossOrigin`；**残留**：仍为第三方 CDN（`swagger-ui-dist@5.17.14`），且 `persistAuthorization:true` 仍将 token 持久化到 localStorage | `frontend/src/app/admin/api-docs/page.tsx:28,42,44-46,52-55` | 改本地打包或固定版本 + SRI；移除 `persistAuthorization` |

---

## 二、认证与授权 / 接口暴露面

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| B3 | `/admin/forbidden-topics/**`、`/admin/faqs/**`、`/admin/related-content/**` 仅 `authenticated()` | **未修复**：三个控制器均无角色/权限注解，任意登录用户即可改敏感词/FAQ/遍历内容 | `.../admin/AdminForbiddenTopicController.java:17-110`、`AdminFaqController.java:16-62`、`AdminRelatedContentController.java:17-87`；`SecurityConfig.java:96` | 加角色级 `@PreAuthorize` |
| B6 | 短信验证码 6 位 + 5 分钟窗口无失败次数限制 | **未修复**：`send-code` 仅按手机号 60s 冷却、无 IP 维度；`verifyCode` 无失败次数上限；`LoginRateLimiter` 仅作用于密码登录 | `SmsService.java:42,44,64-67,69,85-98`；`AuthController.java:67-73` | IP 级限流 + 验证码错误次数上限 |
| S-02（关联 G5） | 访客统计接口匿名可读 | **未修复**：`/stats/**` permitAll，`GET /api/stats/dashboard` 匿名返回运营数据（`/admin/stats` 已有 `stats:view`，但公开副本仍在） | `SecurityConfig.java:84`；`controller/StatsController.java:26-30`；`controller/admin/AdminStatsController.java:17,24-27` | 移入 AdminStatsController 或加权限 |
| S-09（关联 G5） | 存在多余/未使用的公开接口，扩大攻击面 | **部分修复**：Lead CRUD 重复已解决（`LeadController` 仅保留 `POST /leads`、`/leads/from-visitor`，CRUD 归 `AdminLeadController`）；About/Home 公开控制器前端确有调用；**残留**：`Banner/Partner/IndustryChain` 公开控制器仍存在且前端未用 | `/banners`、`/partners`、`/industry-chains`（`BannerController`/`PartnerController`/`IndustryChainController`）；`SecurityConfig.java:89-91` | 删除无用公开接口 |
| B7 | 安全响应头缺失 | **已变化/部分修复**：Spring Security 默认仍发出 `X-Content-Type-Options: nosniff` 等，并已将 `X-Frame-Options` 设为 `SAMEORIGIN`；**残留**：无显式 CSP、无 HSTS，CSRF 仍关闭（无状态 JWT 合理） | `SecurityConfig.java:59-61` | 显式补充 CSP/HSTS（建议在 nginx 代理层施加） |
| B8 | 前端 admin 权限/角色缓存在登录快照 | **部分修复**：AI 服务端已加认证（见 C1），不再是"唯一闸门"；前端权限仍缓存于登录快照，吊销/变更需重新登录才生效 | `useAuth.tsx:43-51`、`admin-layout.tsx` | 会话内按需重拉权限 |
| S-10 | 后台访问是否对外限制未明确 | **未修复**：`/admin/**` 仍仅 JWT 鉴权；`docker/nginx.conf.d` 无 `allow/deny`；无内外网/来源限制 | `SecurityConfig.java:96`；`docker/nginx.conf.d` | 明确内外网/角色访问策略并落实到 SecurityConfig / 代理层 |
| S-12 | `permitAll` 路径重复声明 | **未修复**：`/resources/**` 仍在两处重复放行，规则冗余易误改 | `SecurityConfig.java:76` 与 `:87` | 去重 |

---

## 三、AI 服务（FastAPI `/ai`）控制面暴露

> 共性根因：`AI_consultant` 曾长期无任何认证。**现况**：已引入认证中间件（后端 JWT 或内部令牌，`AI_consultant/auth.py`），Python 入口默认回环 `127.0.0.1`；但路由保护按前缀/精确匹配拼接，仍有大量开放端点，CORS 仍通配 + 携带凭据，容器内仍强制 `0.0.0.0`。

| 编号 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| C1 | `/ai` 大量路由未鉴权 + CORS 通配携带凭据 + 容器监听 `0.0.0.0` | **部分修复**：新增认证中间件（`auth.py:136-186`），已保护 memory/forbidden/knowledge/documents/rag-config/seo/stats/models/model-config 及非 GET 的 config/prompt-config；入口默认改为 `127.0.0.1`。**残留**：`POST /ai/chat`、全部 `/ai/sessions*`（含 DELETE）、`POST /ai/prompt-config/suggestions/generate`、`POST /ai/users/{username}/memory/init`、全部 `/ai/md/*`、`/ai/translate/health` 仍无鉴权；`allow_origins=["*"]`+`allow_credentials=True` 未改；`docker/ai.Dockerfile` 仍 `--host 0.0.0.0` | `AI_consultant/api.py:81-87,90-101,1522`；`auth.py:136-186`；`main.py:2232`；`docker/ai.Dockerfile:17` | 全部 `/ai` 走服务端签发身份；收紧 CORS；容器不改绑默认 |
| C6 | 跨用户共享 Redis `active_session` key | **未修复**：仍为全局 key、未按用户命名空间；进程内单例引擎共享"当前会话"，worker 重启/切换可能续上他人会话 | `AI_consultant/db.py:130-146`；`main.py:1136-1142` | 会话 key 绑定真实登录身份 |
| C7 | 限流可绕过 | **未修复**：guest 按客户端 `visitor_id/session_id`、user 按请求体 `username` 计数，旋转即绕过；Redis 故障降级为内存 dict（`_mem_user`/`_mem_guest`）且无界增长；多 worker 下计数翻倍 | `api.py:294-295,300`；`rate_limit.py:118-135,137-144,171-179` | 绑定服务端签发身份；限制字典增长 |
| C8 | `/docs`、`/openapi.json` 默认暴露；`migrate.py` 的 `drop_tables()` 无保护开关 | **未修复**：未设 `docs_url=None`/`openapi_url=None`；删除表脚本仅靠 CLI `--drop` | `AI_consultant/api.py:78`；`migrate.py:25-28` | 生产关闭 docs；drop 加保护开关 |

---

## 四、XSS / 注入类（前端渲染 + 提示注入）

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| D3（关联 S-03） | `dangerouslySetInnerHTML` 渲染富文本/附件文档 HTML，无 DOMPurify 等清洗 | **未修复**：全仓仍无 DOMPurify；`BlockContent.tsx:214`（rich_text 直出）、`ModuleDetailView.tsx:51`、`FilePreview.tsx:183`（mammoth 转 docx）。HTML 块经 `iframe sandbox`（不含 `allow-same-origin`）隔离属部分缓解；`SeoHead`/`SiteJsonLd` 走 `safeJsonLd` 转义 | `frontend/src/components/BlockContent.tsx:214`、`modules/ModuleDetailView.tsx:51`、`FilePreview.tsx:183`、`HtmlBlockView.tsx:193-207` | 所有入库 HTML 统一用 DOMPurify 白名单清洗后再渲染 |
| D4 | 提示注入 | **部分修复**：RAG/记忆改为带标签的 `ContextBlock` 注入，附件文本进入敏感词检测；上传/知识库接口已加鉴权。**残留**：RAG/记忆内容仍无"内容≠指令"围栏；`POST /ai/prompt-config/suggestions/generate` 仍开放 | `AI_consultant/main.py:207-221,1071-1093,1701-1708`；`api.py:146-148` | 内容与指令隔离；开放端点纳入鉴权 |

---

## 五、文件访问 / 路径穿越 / SSRF / 上传

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| E3 | 后端上传 `type` 参数未白名单校验 | **未修复**：`type` 直接拼入存储/回显路径（`subPath` 已净化，但 `type` 未校验，可穿越上传根目录） | `backend/.../controller/UploadController.java:67-71,104,120` | type 白名单校验 |
| E4 | `ChatUploadController` 扩展名不校验 | **部分修复**：已加魔数 MIME 检测，`.html/.svg` 不再通过；**残留**：无点文件名仍 `StringIndexOutOfBoundsException`（500） | `backend/.../controller/ChatUploadController.java:46-50,52-53` | 空文件名处理 |
| E5 | 前端"登录后可下载/预览"仅前端判断 | **未修复**：后端 `/uploads/**`、`/files/**` 仍公开；下载/预览不带 token | `SecurityConfig.java:93-94`；`ModuleDetailView.tsx:133-139,174-182`；`lib/utils.ts:21-41`；`FilePreview.tsx:80-107` | 后端对受保护资源鉴权 |
| E6 | 附件/文档上传无大小上限与 MIME 白名单 | **部分修复**：后端 multipart 现为 20MB、nginx `client_max_body_size 20m`、compose 不再覆盖；前端新增 `uploadRules.ts` 尺寸/扩展名校验。**残留**：AI 侧附件/文档仍整文件 `read()`、无 MIME/页数/zip-bomb 限制 | `backend/.../application.yml:36-39`；`docker/nginx.conf.d:6`；`frontend/src/lib/uploadRules.ts`；`AI_consultant/api.py:1192`、`knowledge.py:511-540` | 限制大小/MIME、流式解析与 zip-bomb 防护 |
| D5 | `images` 接受任意 URL 交由视觉模型服务端抓取 | **部分修复**：知识库文档图片抓取已加白名单（限后端域名、禁跳转）；**残留**：聊天 `images` 的 http(s) URL 仍原样透传给视觉模型 | `AI_consultant/api.py:171-190`；`knowledge.py:433-464` | URL 白名单或禁公网抓取 |

---

## 六、加密 / 密钥实现

| 编号 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| F2 | AES 密钥派生：非 Base64/非法长度回退裸 SHA-256（无 KDF/盐） | **未修复**：弱口令可暴力；Python lenient `b64decode` 与 Java 严格解析易得出不同密钥 | `SecretCryptoService.java:77-89`、`AI_consultant/main.py:196-226` | 统一 KDF 与 Base64 解析规则 |
| F3 | RSA 传输密钥对每次重启重新生成且不持久化 | **未修复**：启动即重新生成 2048 位密钥对 | `SecretCryptoService.java:53-67` | 密钥对持久化；公钥独立下发 |
| F4 | RSA 解密对无界输入执行 | **部分修复**：加了解密后长度告警与异常日志；RSA-2048/OAEP 实际已将明文限制在约 190 字节内，但密文入参仍无显式长度校验（`>4096` 告警分支实际不可达） | `SecretCryptoService.java:194-216` | 显式限制密文长度 |
| F5 | `SecretConfigMigrationRunner` 吞掉所有异常并跳过迁移 | **未修复**：仅 `log.warn` 后继续，明文敏感项可能静默残留 | `SecretConfigMigrationRunner.java:58-60` | 记录并告警失败项 |

---

## 七、安全配置 / 依赖 / 部署资产

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| G1 | Spring Boot **2.7.18 已 EOL** | **未修复**：无安全补丁，目标 Java 1.8 | `backend/pom.xml:10,18-21` | 升级受支持版本 |
| G3 | 无 CSP/安全头且站点含多存储型 XSS 面 | **未修复**：`next.config.js` 无 `headers()`（静态导出亦无法施加），`docker/nginx.conf.d` 无 `add_header` | `frontend/next.config.js`；`docker/nginx.conf.d` | 在 nginx 代理层补 CSP/HSTS 等安全头 |
| B5 | SpringDoc Swagger 在生产主配置开启 | **部分修复**：`/swagger-ui/**`、`/v3/api-docs/**` 等已要求 `system:api-docs:view` 权限；**残留**：`springdoc` 仍在主配置启用，未按 profile 关闭 | `backend/src/main/resources/application.yml:73-78`；`SecurityConfig.java:97-102`；`sinounion.sql:636` | 生产 profile 关闭 |
| G2 | Next.js 15.3.3 版本偏旧 | **未修复**：非最新 15.x 安全补丁 | `frontend/package.json:20` | 升级到最新 15.x |
| G5（关联 S-02、S-09） | 前台公开 `/seo/**`、`/stats/**`、`/ai/**`、`/upload/**` 等宽泛放行 | **未修复**：`SecurityConfig` permitAll 仍含 `/ai/**`、`/stats/**`、`/seo/**`、`/upload/**`、`/uploads/**`、`/files/**` 等 | `SecurityConfig.java:66-95` | 逐接口最小化放行 |
| G6 | 测试产物与二进制入库 | **部分修复**：`test-results/`、`playwright-report/`、`coverage/` 等已进 `.gitignore` 且不再追踪；**残留**：`ip2region.xdb`（约 11MB）仍入库，`.gitignore` 无 `*.xdb` 规则 | git 追踪列表；`backend/src/main/resources/ip2region.xdb` | 移出追踪或改 Git LFS / 构建时下载 |

---

## 八、代码缺陷（健壮性 / 并发 / 逻辑）

| 编号 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| H1 | `LeadServiceImpl.assignLead/updateLeadStatus` 对不存在的 id 直接解引用 → NPE 500 | **未修复**：应 404 | `backend/.../service/impl/LeadServiceImpl.java:184-190,192-197` | 判空返回 404 |
| H4 | `.env` 在线改写非原子（整文件重写、丢注释/引号） | **未修复**：`readAllLines`→内存改→`Files.write`，无临时文件+原子重命名与加锁，与启动写密钥存在并发冲突面 | `AdminEnvConfigController.java:160-188` | 原子化/串行化写入 |
| H5 | Python 每个 `/ai/chat` 一个 daemon 线程 + 共享 4-worker 线程池无信号量 | **未修复**：daemon 线程每请求一条；共享 `ThreadPoolExecutor(max_workers=4)`；`_memory_cache`/`link_resolver._cache`/`translation/live._CACHE` 无界 | `AI_consultant/api.py:287`；`main.py:1710-1715,1758-1768`；`knowledge.py:54`；`link_resolver.py:89`；`translation/live.py:20` | 有界线程池/信号量、清理缓存 |
| H6 | 运行时用共享特权 DB 账号执行 DDL | **未修复**：`CREATE EXTENSION vector`、`ALTER … embedding TYPE vector(dim)` 等运行时执行，生产存在表锁/整表重写风险 | `AI_consultant/knowledge.py:687-703`；`forbidden_detector.py:50-74` | 迁移与运行账号分离 |
| H2 | `AdminRelatedContentController.batch` 对非数字 `ids` 抛 `NumberFormatException` → 500 并回显 | **未修复**：应 400 | `AdminRelatedContentController.java:53-56` | 参数校验 |
| H3 | `AuthController /auth/me` 用户被删后 `user` 为 null → NPE | **部分修复**：被删用户在 `JwtAuthenticationFilter` 即被拒（401）；控制器仍无判空，存在"过滤器通过后删除"的竞态 NPE | `AuthController.java:59-65`；`security/JwtAuthenticationFilter.java:44-48` | 判空 |
| H7 | `db.py` `int(PG_PORT)` 于 import 时报错崩溃；Redis 助手吞连接异常返回 `None` | **未修复**：`PG_PORT` 无默认值；Redis 连接失败静默返回 `None`，调用方须处处判空 | `AI_consultant/db.py:21,31,109-125` | 启动校验配置；连接失败明确报错 |
| H8 | `AdminEnvConfigController` / `AdminConfigFileController` 允许在线写任意 `application.yml`/`.env` 内容 | **部分修复**：两控制器仍在，已加 `page:config:edit` 权限门；写入仍不限制 key/内容白名单（近 RCE 面） | `AdminConfigFileController.java:62-77`；`AdminEnvConfigController.java:126-194` | 收紧内容校验与审计日志 |

---

## 九、数据与功能缺陷

| 编号 | 缺陷项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| D-01 | 线索中文乱码 | **已变化/待确认**：仓库内已无 GB18030/GBK 代码，Spring/PG 默认 UTF-8，问题预计不再复现；但未显式设置 `client_encoding`/`charSet`，缺针对性修复证据 | `application.yml:17`（JDBC URL）；`docker/docker-compose.yml` | 显式统一 UTF-8 编码，排查表单提交链路 |
| D-06 | 数据库导入导出异常 | **未修复**：无导入/导出/备份/恢复能力（仅线索 CSV 导出）；仍依赖 `.sql` 初始化脚本 | 后端无对应实现 | 支持可视化工具快速导入/备份 |
| D-07 | 数据库无法实时保存，存在配置丢失风险 | **未修复**：无逐项备份/每晚备份策略（仅临时文件清理与定时发布任务） | 后端无对应任务 | 每填一项即备份 env/DB/持久化文件 + 每晚备份策略 |
| D-08 | 内容无法切换历史版本 | **未修复**：无版本/历史表与接口 | `ContentItem.java`；`sinounion.sql` | 补充历史版本记录与切换能力 |
| D-11 | 接口失败无友好弹窗 | **部分修复**：聊天错误码→友好 i18n（`chatError.ts`）、公共页统一 `PageState`；**残留**：无统一 API 失败弹窗，`lib/toast.ts` 为死代码，未配置向量化/重排模型时仍无显式告警 | `frontend/src/lib/chatError.ts`；`components/PageState.tsx`；`lib/toast.ts` | 统一错误弹窗与可配置提示 |

---

## 十、代码与架构质量

| 编号 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| Q-02 | env 配置项冗余 | **部分修复**：存在 `PG_*`/`SPRING_DATASOURCE_*`、`REDIS_*`/`SPRING_REDIS_*`、`PYTHON_SERVICE_URL`/`PYTHON_HOST/PORT` 双套覆盖；`IP_LOCATION_*` 未在 `.env.example` 暴露 | `.env.example`；`application.yml:17-34,84` | 全量梳理整合 |
| Q-03 | 数据库存在多余无用表 | **未修复（存疑）**：约 36 张表粗核均有 Java/Python 引用，无可确证的无用表；未做清理 | `sinounion.sql` | 清理无用表 |
| Q-04 | 聊天 SSE 逻辑两处重复且行为不一致 | **已变化**：`ChatWidget.tsx` 已无人引用（死代码），实际仅 `(public)/page.tsx` 一条 SSE 路径；重复实现仍留在源码 | `(public)/page.tsx:329-397`；`components/ChatWidget.tsx:139-195` | 删除死代码并抽取共用 `useChatStream` |
| Q-05 | axios/fetch 混用，aiApi 不带 token、无 401 处理 | **部分修复**：`aiApi.ts` 已带 token 与 401→refresh→重试，`api.ts` 统一拦截器；**残留**：AI SSE（`(public)/page.tsx:768`）仍裸 `fetch` 无 token/401，`admin/leads/page.tsx` 手工读 token | `src/lib/aiApi.ts:11-49`；`src/lib/api.ts:12-56`；`(public)/page.tsx:768` | 统一客户端封装，统一 token/401 逻辑 |
| Q-06 | 首页 4 个模块区块近乎重复 | **部分修复**：新增通用 `GenericModuleSection` 兜底，但 products/solutions/cases/resources 仍为 4 个近似重复渲染函数 | `(public)/page.tsx:1005-1113` | 合并为单一渲染组件 |
| Q-07 | admin CRUD 页面样板重复 | **部分修复**：确认弹窗已抽 `useConfirm`/`ConfirmDialog` 与 `BatchToolbar`；表格/分页/loadData 样板仍各页重复 | `components/ConfirmDialog.tsx`、`BatchToolbar.tsx`；`admin/users/page.tsx:98`、`admin/faqs/page.tsx:153`、`admin/leads/page.tsx:315` | 抽取 AdminTable/Pagination 公共组件 |
| Q-08 | 死代码与未使用配置 | **未修复**：`src/styles/globals.css` 未被引用、`config.ai.sessionTimeout` 未使用、`(public)/page.tsx` 的 `homeProducts` 未使用 | `config/index.ts:30`；`(public)/page.tsx:440` | 清理 |
| Q-09（关联 E-01） | 大量硬编码中文未走 i18n | **部分修复**：新增 `i18n/parts/*`，公共页/后台多数组件已接入 `t()`；**残留**：`(public)/page.tsx` 附件提示串、死代码 `ChatWidget` 仍硬编码 | `i18n/parts/*`；`(public)/page.tsx:147-156` | 公共页面全量接入 `t()` |

---

## 十一、样式与渲染

| 编号 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| R-01 | 样式不统一 | **未修复**：约 16 处原生 `<img>`（均无 `loading="lazy"`）、约 34 处内联 style | 全站；`next.config.js:7` 已 `images.unoptimized` | 统一 next/image + Tailwind 主题变量 |
| R-02 | 全站静态导出但全部客户端拉接口 | **未修复（设计如此）**：`output:'export'`，无 SSR/SEO 渲染 | `next.config.js:3-5` | 确认架构意图；内容页考虑 SSG 预取 |

---

## 十二、部署与运维

| 编号 | 问题项 | 现状与影响 | 整改建议 |
| --- | --- | --- | --- |
| O-02 | 容器间互通未充分验证 | **部分修复**：compose 已有 healthcheck 与 `depends_on`，且不再强制 `PYTHON_HOST=0.0.0.0`（改由挂载 `.env` 控制）；**残留**：文档无连通性验证步骤；healthcheck 用户与默认 `POSTGRES_USER` 不一致（`pg_isready -U ${DB_USER:-sinounion}` vs `POSTGRES_USER:-root`），`PG_PORT`/`REDIS_PORT` 无默认值 | 逐一验证并固化：后端↔前端、后端↔python、前端↔python；补连通性验证步骤 |

---

## 十三、需求与体验（非缺陷，待排期）

| 编号 | 事项 | 现状与说明 | 待确认/建议 |
| --- | --- | --- | --- |
| E-01（关联 Q-09） | 中英文切换不完整 | **部分修复**：公共页/后台大面积接入 i18n，AI 回答随界面语言切换（新增翻译管线）；**残留**：部分硬编码串与 AI 聊天附件提示 | 公共页面全量接入 i18n |
| E-03 | 缺少 Demo 门户网站 | **未修复**：仅种子"演示产品/方案"内容，无独立演示门户 | 明确是否开放管理员账号；开放后前后台内容是否加访问限制 |

---

## 十四、本次修订新增观察项

> 以下为核验当前工作区时新识别、或由本次改动引入的问题，供后续排期参考；已修复的新增项同样按精简原则移除。

| 编号 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| N-01（关联 A8） | `encryptSecret` 在非安全上下文静默回退明文传输 | **未修复**：`crypto.subtle` 不可用（HTTP）时直接返回明文，敏感密钥经明文请求体传输 | `frontend/src/lib/secretCrypto.ts:26-29` | 强制 HTTPS；非安全上下文应报错而非静默降级 |
| N-03（关联 C1/C4） | 未鉴权 AI 管理/连通性接口 | **部分修复**：`/ai/model-config/test` 已纳入 `/ai/model-config` 前缀鉴权；**残留**：`/ai/md/*` 仍无鉴权（只读渲染，泄露内容） | `AI_consultant/api.py`；`ai_md.py:450-486`；`auth.py:179,181` | 统一鉴权；测试端点限制来源与目标白名单 |
| N-05 | `X-Real-IP` 被无条件信任，可伪造 IP | **未修复**：`ClientIpResolver` 直接取 `X-Real-IP`，配合 `forward-headers-strategy: none` 且后端监听 `0.0.0.0`；e505d34 删除了原有可信代理链/CIDR 校验。直连后端者可伪造 IP，绕过登录 IP 限流、污染线索 IP/属地 | `backend/.../util/ClientIpResolver.java:19-31`；`application.yml:7-9,93-95`；`security/LoginRateLimiter.java:69`；`controller/LeadController.java:89` | 恢复可信代理校验或强制经代理（`$remote_addr`），后端不直接对外暴露 |
| N-06（关联 F1） | 系统密钥以明文存于 DB `system_secrets` 表 | **未修复**：`JWT_SECRET`/`AI_INTERNAL_TOKEN`/`CONFIG_CRYPTO_AES_KEY` 明文落库；DB 写入失败退化为一次性内存密钥（重启即失效，需重新登录） | `backend/.../config/SystemSecretService.java:43-50,89-111` | 对密钥表加密/受控访问；写入失败显式告警 |
| N-07（关联 C1/C7） | 新增未鉴权且无限流的昂贵 AI 端点 | **未修复**：`POST /ai/prompt-config/suggestions/generate` 触发嵌入+重排+LLM 生成，既不在鉴权前缀内也不受限流约束，匿名可反复调用（钱包耗尽/DoS） | `AI_consultant/api.py:621-679`；`auth.py:161-186`；`docker/nginx.conf.d:26-27` | 纳入鉴权与限流 |
| N-08（关联 O-02/N-04） | 容器以 root 运行且 DB/Redis 暴露全接口 + 弱默认口令 | **未修复**：`ai/backend/frontend` Dockerfile 均无 `USER`；compose 将 PG/Redis 端口发布到所有主机接口并带弱默认口令 | `docker/*.Dockerfile`；`docker/docker-compose.yml:25-28,43-45` | 非 root 运行、绑定 `127.0.0.1` 或内网、强制强口令 |
| N-09（关联 D3） | docx 预览以 `dangerouslySetInnerHTML` 注入 mammoth 产物 | **未修复**：`FilePreview.tsx` 将 `mammoth.convertToHtml` 结果直出，mammoth 非严格清洗器，恶意 docx 可致 HTML 注入/外链加载 | `frontend/src/components/FilePreview.tsx:88,183` | 对 mammoth 产物做 DOMPurify 清洗 |
