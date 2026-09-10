# 系统安全与缺陷风险清单

> 本清单由 AI 基于项目源代码、配置文件、接口实现及相关项目文档进行自动化分析与测试后生成，记录测试过程中识别出的潜在安全风险、功能缺陷、代码质量问题及其他风险事项。
>
> 清单中的风险结论、风险等级及整改建议均来源于 AI 测试与分析结果，部分问题可能存在误报、漏报或需要结合实际运行环境进一步确认的情况。因此，本清单主要作为项目风险识别、问题排查和后续整改的参考依据，**不等同于人工安全审计、渗透测试或第三方安全认证结论**。
>
> 项目后续开发、测试及版本迭代过程中，将持续通过 AI 辅助测试与人工复核更新本清单。

## 清单说明

* **测试方式**：AI 自动化代码分析、静态检查、逻辑分析及相关测试
* **分析对象**：项目源代码、配置文件、接口及相关项目文档
* **风险范围**：安全风险、功能缺陷、代码质量、配置风险、数据风险及其他潜在问题
* **风险等级**：🔴 严重 / 🟠 高 / 🟡 中 / ⚪ 低
* **结论性质**：AI 测试与分析结论，需结合实际环境进行人工复核
* **维护方式**：随着项目版本迭代持续更新

> **特别说明：** 本清单用于辅助项目开发与质量管理，不构成对系统不存在安全漏洞或其他缺陷的保证。

---


## 一、凭据与机密泄露

| 编号(来源) | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| A1 | 🔴 严重 | `.env` 含真实凭据被 git 追踪并随开源发布 | 含可伪造任意 JWT 的 `JWT_SECRET`、能解密 `system_configs` 全部敏感配置的 `CONFIG_CRYPTO_AES_KEY`；仓库历史旧值视为已泄露 | 根目录 `.env`（原 `git ls-files` 确认入库） | **已处置**：`git rm --cached .env`（配合既有 `.gitignore`），`.env.example`/README 去除弱口令示例。**仍需人工**：轮换 DB/Redis/JWT/AES 全部密钥并清理 git 历史 |
| A3 | 🟠 高 | 默认超级管理员 `admin/admin123` 未强制改密 | bcrypt 种子、README 公开该口令 | `backend/src/main/resources/sinounion.sql:649-651` | 首次登录强制改密 / 部署时校验弱口令 |
| A4 | 🔴 严重 | SMS 验证码"开发兜底"把验证码明文返回并打印日志 | 生产若未配置短信即等于可接管任意手机号账号（`send-code`/`login-by-code` 为公开接口且自动注册） | `backend/.../service/SmsService.java:77-81` | 生产环境禁用兜底回显；开发/生产 profile 隔离；对 `send-code`/`login-by-code` 做 IP 限流与错误次数限制 |
| A5（关联 BUG S-03、D-13） | 🟠 高 | JWT 存 `localStorage` + 非 HttpOnly/非 Secure cookie | logout 仅清浏览器，token 有效期内仍可用（无服务端吊销）；叠加 S-03 注入链路可被窃取登录态 | `frontend/src/hooks/useAuth.tsx:41-60,94-102`；`src/lib/api.ts:11` | token 改 httpOnly cookie；服务端 `tokenVersion`/黑名单吊销；未登录时不发 `user-join` 事件（消除 D-13 警告） |
| B4 / S-06 | 🟠 高 | CORS 全开放且配置重复 | `AllowedOriginPatterns("*")` + `allowCredentials=true`；`CorsConfig` 与 `SecurityConfig` 两套完全相同配置 | `backend/.../config/CorsConfig.java:16-21`；`backend/.../config/SecurityConfig.java:33-43` | 限定允许来源白名单；删除其中一套重复定义 |
| A8 / S-04 / S-05 | 🟠 高 | 后台密钥明文往返保存并回显 | 短信 `sms_access_key_secret`、模型 API Key（「系统配置→短信服务」「AI管理→模型参数配置」）明文可见，浏览器/F12 可直接查看 | `frontend/src/app/admin/settings/page.tsx:349-351,353-363,393`；关联 `AdminSystemConfigController` | 密钥仅服务端存储；回显掩码；仅变更时写入；加密传输，只提供修改、不提供查看 |
| A9 / D-12 | 🟡 中 | `localStorage` 解析无异常兜底 | `JSON.parse` 无 try/catch，损坏数据导致整页崩溃/白屏 | `useAuth.tsx:47-48`、`useTracking.ts:54`、`admin-layout.tsx:225-236` | 增加异常兜底处理 |
| A6 / S-11 | 🟡 中 | 管理端 api-docs 运行时从第三方 CDN 加载 Swagger UI | 无 SRI 的第三方 bundle 供应链风险；`persistAuthorization` 持久化 token 到 localStorage | `frontend/src/app/admin/api-docs/page.tsx:23-51`（42,49 加载处） | 改本地打包或固定版本 + SRI；移除 `persistAuthorization` |

---

## 二、认证与授权 / 接口暴露面

| 编号(来源) | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| B1 / S-01 | 🔴 严重 | 线索接口未鉴权，匿名可读写全部线索 | `/leads/**` 全部 permitAll，列表/详情/状态/指派/活动接口匿名可达、无 IDOR 校验；已在线验证 `GET /api/leads` 返回真实线索（姓名/手机/邮箱/IP/需求），构成严重 PII 泄露 | `SecurityConfig.java:78`；`LeadController.java:73-127` | 公开仅保留 `POST /leads`（前台表单）与 `POST /leads/from-visitor`；其余移入 `AdminLeadController` 并加权限 |
| B2 | 🔴 严重 | `/admin/ai/**` 知识库同步等接口仅要求登录、无角色校验 | 任意注册用户可刷队列造成资源耗尽 | `backend/.../controller/admin/AdminAIController.java:43,103,123,133` | 加角色/权限校验 |
| B3 | 🟠 高 | `/admin/forbidden-topics/**`、`/admin/faqs/**`、`/admin/related-content/**` 仅 `authenticated()` | 普通用户可改敏感词/FAQ/遍历内容 | 对应 `AdminForbiddenTopicController` / `AdminFaqController` / `AdminRelatedContentController` | 加角色级 `@PreAuthorize` |
| B6 | 🟠 高 | 短信验证码 6 位 + 5 分钟窗口无失败次数限制 | `send-code` 仅按手机号 60s 冷却、无 IP 维度，可短信轰炸/爆破 | `SmsService.java:64-73`；`AuthController.java:64-75` | IP 级限流 + 验证码错误次数上限 |
| S-02（关联 G5） | 🟠 高 | 访客统计接口匿名可读 | `/stats/**` permitAll，`GET /api/stats/dashboard` 匿名返回今日访问量等运营数据 | `SecurityConfig.java:79` | 移入 AdminStatsController 或加权限 |
| S-09（关联 G5） | 🟡 中 | 存在多余/未使用的公开接口，扩大攻击面 | Banner/Partner/IndustryChain/AboutSection/HomeSection 公开 Controller 与 Admin 侧重复且前端无调用；Lead CRUD 双份 | `/banners`、`/partners`、`/industry-chains`、`/about-sections`、`/home-sections`；`LeadController.java`、`controller/admin/AdminLeadController.java` | 全量排查并删除无用公开接口；Lead 合并为单一 Admin 控制器 |
| B7 | 🟡 中 | 无安全响应头 | 缺失 CSP/HSTS/`X-Content-Type-Options`/`X-Frame-Options`；CSRF 关闭（无状态 JWT 合理但响应头仍缺失） | `SecurityConfig.java:55-100` | 补充安全响应头 |
| B8 | 🟡 中 | 前端 admin 权限/角色缓存在登录快照 | 吊销/变更需重新登录才生效（Java 侧有强校验属显示层滞后；但对 Python AI 面是唯一闸门） | `useAuth.tsx:40-51`、`admin-layout.tsx:224-259` | 会话内按需重拉权限 / AI 面加服务端鉴权 |
| S-10 | 🟡 中 | 后台访问是否对外限制未明确 | 「网页是否限制访问后台」需求未落实 | 安全配置全局 | 明确内外网/角色访问策略并落实到 SecurityConfig |
| S-12 | ⚪ 低 | `permitAll` 路径重复声明 | `/resources/**` 重复放行两次，规则冗余易误改 | `SecurityConfig.java:71` 与 `:82` | 去重 |

---

## 三、AI 服务（FastAPI `/ai`）控制面暴露

> 共性根因：`AI_consultant/api.py` **无任何认证**，CORS 通配 + 携带凭据，`uvicorn` 绑定 `0.0.0.0:8000`，FastAPI `/docs` 默认开启。任何能访问 8000 端口的人都是"管理员"。后端 `SecurityConfig` 亦放行 `/ai/**`，前端 admin 页面直连该服务且**不携带 token**，因此"只有后台菜单能进"是唯一防线。

| 编号 | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| C1 | 🔴 严重 | `/ai` 全路由无认证、CORS `*` + 凭据、监听 0.0.0.0 | 控制面完全开放 | `AI_consultant/api.py:30-39`（及全文路由）、`AI_consultant/main.py:1733-1735` | 给 `/ai` 加 API-Key / 服务端 token 校验（后端签发、前端经后端代理），关闭对公网直连 |
| C4 | 🔴 严重 | 可未授权改写模型 `base_url` 等配置 | 把真实 provider API Key 发送到攻击者服务器 | `AI_consultant/api.py:297-316`、`main.py:1719-1724` | `base_url`/system prompt 等写操作仅允许后端来源 |
| C5 | 🔴 严重 | `DELETE /ai/memory`、知识库 CRUD、`/seo/generate`、`reembed` 无鉴权 | 可全局删数据 / 刷 LLM 成本 | `AI_consultant/api.py:613-616,736-954` | 全部鉴权 + 按身份隔离 |
| C6 | 🟠 高 | 跨用户共享 Redis `active_session` key | worker 重启/切换时可能续上他人会话；多 worker 下内存限流计数翻倍 | `AI_consultant/db.py:95-111`、`main.py:943-950`、`rate_limit.py:101-169` | 会话 key 绑定真实登录身份 |
| C7 | 🟠 高 | 限流可绕过 | guest 按 `visitor_id`/`session_id`、user 按请求体 `username` 计数，旋转即绕过"每日5次/每分钟30次"；Redis 故障降级为内存计数且 dict 无界增长 | `api.py:96-103`、`rate_limit.py` | 绑定服务端签发身份；限制字典增长 |
| C8 | 🟡 中 | `/docs`、`/openapi.json` 默认暴露；`migrate.py` 的 `drop_tables()` 无保护开关 | 接口文档/破坏性脚本可被访问 | `AI_consultant/api.py:30`、`migrate.py:25-28` | 生产关闭 docs；drop 加保护开关 |

---

## 四、XSS / 注入类（前端渲染 + 提示注入）

| 编号(来源) | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| D1（关联 S-03） | 🔴 严重 | HTML 代码块 iframe `sandbox="allow-scripts allow-same-origin …"` | 两标志同开=沙箱失效，CMS 内容可读同源 localStorage（JWT）、对访问者/管理员执行任意脚本；组件 `VH_FIX_SCRIPT` 已访问 `window.parent`；渲染于前台首页与详情页 | `frontend/src/components/HtmlBlockView.tsx:199-214`（注释 66-73、脚本 15-17） | 去掉 `allow-same-origin`（保留 `allow-scripts` 单独），或在独立 origin iframe/worker 中渲染并再脱敏 HTML |
| D2 | 🔴 严重 | JSON-LD 用 `JSON.stringify` 注入 `<script type="application/ld+json">` | CMS 文本中的 `</script>` 可逃逸出 JSON 块执行脚本 | `SeoHead.tsx:124-130`、`app/layout.tsx:139-142`、`ModuleDetailView.tsx:187-193` | 对 `</script>`/`<` 转义后拼入，或走结构化数据组件 |
| D3（关联 S-03） | 🟠 高 | `dangerouslySetInnerHTML` 渲染富文本/附件文档 HTML，无 DOMPurify 等清洗 | 后台编辑器仅对"粘贴"做纯文本化，拖拽/`insertHTML`/历史/导入内容仍可带事件属性 | `BlockContent.tsx:214`、`ModuleDetailView.tsx:38-44`、`FilePreview.tsx:50-78` | 所有入库 HTML 统一用 DOMPurify 白名单清洗后再渲染 |
| D4 | 🟠 高 | 提示注入 | RAG 检索内容、用户记忆、附件文本被原样拼进 system prompt，无"内容≠指令"围栏；敏感词过滤仅作用于原始输入；上传与知识库数据源无鉴权可对共享 RAG 投毒 | `AI_consultant/main.py:1417-1441,887-899,1489-1499`、`api.py:66-90` | 内容与指令隔离；上传/知识库加鉴权与隔离 |

---

## 五、文件访问 / 路径穿越 / SSRF / 上传

| 编号(来源) | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| E1 | 🔴 严重 | `resolve_media_file`：本地绝对路径直接读**任意文件**；任意 `http(s)` 目标经共享 `httpx.Client`（默认跟随重定向）抓取 = SSRF | 云元数据/内网探测，可由未授权 `sync-document` 单请求触发 | `AI_consultant/knowledge.py:349-388`、`api.py:918-939` | 路径白名单 + resolve 后校验；SSRF 目标白名单/禁重定向 |
| E2 | 🔴 严重 | 记忆文件 `filename` 未净化直接拼接路径 | `../.env` 等任意文件读写（读泄露、写可污染配置/源码） | `AI_consultant/main.py:386-389,574-583`、`api.py:624-637` | 文件名白名单 + `resolve()` 后校验须在 `MEMORY_DIR` 内 |
| E3 | 🟠 高 | 后端上传 `type` 参数未白名单校验 | 直接拼入存储/回显路径 | `backend/.../controller/UploadController.java:99` | type 白名单校验 |
| E4 | 🟠 高 | `ChatUploadController` 扩展名不校验 | 可存 `.html/.svg` 供浏览器执行（存储型 XSS 面）；无点文件名会 `StringIndexOutOfBoundsException` | `backend/.../controller/ChatUploadController.java:53-56` | 校验扩展名/MIME + 空文件名处理 |
| E5 | 🟠 高 | 前端"登录后可下载/预览"仅前端判断 | 后端 `/uploads/**`、`/files/**` 为公开，专属资料保护形同虚设 | `SecurityConfig.java:88-89`；`ModuleDetailView.tsx:129-135` | 后端对受保护资源鉴权 |
| E6 | 🟡 中 | 附件/文档上传无大小上限与 MIME 白名单 | 整文件 `read()`；PDF/DOCX 解析无 zip-bomb/页数限制 | `AI_consultant/api.py:79-82,822-859`、`knowledge.py:418-447` | 限制大小/MIME、流式解析与 zip-bomb 防护 |
| D5 | 🟡 中 | `images` 接受任意 URL 交由视觉模型服务端抓取 | 内容传输给第三方/内网探测（SSRF 面） | `AI_consultant/main.py:1140-1144` | URL 白名单或禁公网抓取 |

---

## 六、加密 / 密钥实现

| 编号 | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| F1 | 🟠 高 | AES 主密钥未配置时启动自动生成并**写回被 git 追踪的 `.env`** | 落盘加密失去意义（叠加 A1 = 敏感配置全量泄露） | `SecretCryptoService.java:115-143` | 密钥改注入/密钥管理系统，禁止回写 git 追踪文件 |
| F2 | 🟡 中 | AES 密钥派生：非 Base64/非法长度回退裸 SHA-256（无 KDF/盐） | 弱口令可暴力；Python lenient `b64decode` 与 Java 严格解析对含空白 Base64 得出不同密钥 → 解密失败难排查 | `SecretCryptoService.java:101-113`、`AI_consultant/main.py:196-226` | 统一 KDF 与 Base64 解析规则 |
| F3 | 🟡 中 | RSA 传输密钥对每次重启重新生成且不持久化 | 跨重启的 RSA 加密值失效（前端须每次重取公钥）；公钥可公开却挂在 `page:config:view` 权限后 | `SecretCryptoService.java:66-74,272-279` | 密钥对持久化；公钥独立下发 |
| F4 | 🟡 中 | RSA 解密对无界输入执行 | 大载荷 RSA 运算 = 轻量 DoS 面 | `SecretCryptoService.java:248-269` | 限制密文长度 |
| F5 | 🟡 中 | `SecretConfigMigrationRunner` 吞掉所有异常并跳过迁移 | 明文敏感项可能静默残留未加密 | `SecretConfigMigrationRunner.java:58-60` | 记录并告警失败项 |

---

## 七、安全配置 / 依赖 / 部署资产

| 编号(来源) | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| G1 | 🟠 高 | Spring Boot **2.7.18 已 EOL** | 无安全补丁，目标 Java 1.8 | `backend/pom.xml:10` | 升级受支持版本 |
| G3 | 🟠 高 | 无 CSP/安全头且站点含多存储型 XSS 面 | 失去最后防线；`next.config.js` 无 `headers()`，静态导出亦无法施加 | `frontend/next.config.js:1-21` | 补 CSP 等安全头（服务端代理层施加） |
| B5 | 🟠 高 | SpringDoc Swagger 在生产主配置开启 | `/v3/api-docs`、`/swagger-ui.html` 可访问 | `backend/src/main/resources/application.yml:67-72` | 生产 profile 关闭 |
| G2 | 🟡 中 | Next.js 15.3.3 版本偏旧 | 非最新 15.x 安全补丁 | `frontend/package.json:18` | 升级到最新 15.x |
| G4 | 🟡 中 | 生成型 SEO 文件全站文本对 AI 爬虫开放；域名不一致 | `layout.tsx` 域名（`www.example.cn`）与 robots/sitemap（`www.snlh.cn`）不一致 | `frontend/public/robots.txt`、`frontend/src/lib/seo.ts` | 统一域名；评估 SEO 文件访问策略 |
| G5（关联 S-02、S-09） | 🟡 中 | 前台公开 `/seo/**`、`/stats/**`、`/ai/**`、`/upload/**` 等宽泛放行 | 需逐一确认各控制器是否需鉴权（S-02 stats 匿名返回运营数据、S-09 冗余公开 Controller 已单列） | `SecurityConfig.java:62-90` | 逐接口最小化放行 |
| G6 | 🟡 中 | 测试产物与二进制入库 | `frontend/test-results/.last-run.json` 被提交；大体积 `ip2region.xdb` 入库（仓库卫生） | git 追踪列表 | 移出追踪、完善 .gitignore |

---

## 八、代码缺陷（健壮性 / 并发 / 逻辑）

> 来源：SECURITY_RISKS H 组 + BUG表 D/Q 中涉及健壮性的条目已在相应章节保留；本组为服务端/运行时缺陷。

| 编号 | 等级 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| H1 | 🟠 高 | `LeadServiceImpl.assignLead/updateLeadStatus` 对不存在的 id 直接解引用 → NPE 500 | 应 404 | `backend/.../service/impl/LeadServiceImpl.java:185-197` | 判空返回 404 |
| H4 | 🟠 高 | `.env` 在线改写非原子（整文件重写、丢注释/引号） | 与启动时 `persistAesKeyToEnv` 存在并发写冲突 | `AdminEnvConfigController.java:166-194` | 原子化/串行化写入 |
| H5 | 🟠 高 | Python 每个 `/ai/chat` 一个 daemon 线程 + 共享 4-worker 线程池无信号量 | Token 记录每调用一线程 + 无界缓存 dict；断连仅按块检查 stop → 高并发线程/内存耗尽 | `AI_consultant/api.py:128-158`、`main.py:278-301` | 有界线程池/信号量、清理缓存 |
| H6 | 🟠 高 | 运行时用共享特权 DB 账号执行 DDL（`CREATE EXTENSION vector`、`ALTER … embedding TYPE vector(dim)`） | 生产表锁/整表重写 | `AI_consultant/knowledge.py:508-565`、`main.py:9-28` | 迁移与运行账号分离 |
| H2 | 🟡 中 | `AdminRelatedContentController.batch` 对非数字 `ids` 抛 `NumberFormatException` → 500 并回显 | 应 400 | `AdminRelatedContentController.java:53-56` | 参数校验 |
| H3 | 🟡 中 | `AuthController /auth/me` 用户被删后 `user` 为 null → NPE | 应 401/404 | `AuthController.java:57-61` | 判空 |
| H7 | 🟡 中 | `db.py` `int(DB_PORT)` 于 import 时报错崩溃；Redis 助手吞连接异常返回 `None` | 调用方须处处判空（已导致限流/会话降级行为） | `AI_consultant/db.py:20-33,88-111` | 启动校验配置；连接失败明确报错 |
| H8 | 🟡 中 | `AdminEnvConfigController` / `AdminConfigFileController` 允许在线写任意 `application.yml`/`.env` 内容 | config 权限持有者 ≈ 配置篡改/近 RCE 面，仅靠固定路径约束 | `AdminConfigFileController.java:63-77` | 收紧权限与内容校验、审计日志 |

---

## 九、数据与功能缺陷（BUG 表原 D 组）

| 编号 | 等级 | 缺陷项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| D-01 | 🟠 高 | 线索中文乱码 | 表单姓名/来源页以 GB18030 字节写入 DB，接口按 UTF-8 返回，前端显示乱码；仅线索相关数据受影响 | `GET /api/leads`（name="超级管理"、sourcePage="测试视频1" 均乱码） | 统一请求/存储编码为 UTF-8，排查表单提交链路与 JDBC 连接编码 |
| D-02 | 🟡 中 | 线索所属地无法正确显示 | 线索管理中 IP→属地解析缺失或错误 | 线索管理相关页面 | 参考 https://ipwho.is/ 完善属地解析 |
| D-03 | 🟡 中 | 业务接口返回码与提示文案不统一 | 返回 code 400、文案 `duplicate_submission`，前端难映射友好提示 | `LeadController.java:55/61/68` | 统一错误码规范，前端映射友好弹窗 |
| D-04 | 🟡 中 | 知识库未分组、对话全量检索 | 开启知识库后每次对话全量使用库内容，成本高、精度差 | 知识库模块 | 知识库按模块拆分，AI 对话按分类读取 |
| D-05 | 🟡 中 | 模块详情在线预览部分格式无法渲染 | pdf/md 无法正常预览 | 模块详情页在线预览 | 支持 pdf/md/docx/txt/excel 等格式展示 |
| D-06 | 🟡 中 | 数据库导入导出异常 | 使用 Navicat 等工具导入导出出现数据无法导入 | 数据库运维 | 支持通过可视化工具快速导入/备份数据 |
| D-07 | 🟡 中 | 数据库无法实时保存，存在配置丢失风险 | 填写配置后未及时落盘 | 配置/持久化链路 | 每填一项即备份 env/数据库/持久化文件（保留近 1 小时）+ 每晚备份策略 |
| D-08 | 🟡 中 | 内容无法切换历史版本 | 内容缺少版本管理/回滚能力 | 内容管理模块 | 补充历史版本记录与切换能力 |
| D-09 | 🟡 中 | 后台知识库管理为 mock 假数据 | `listBases` 写死返回"长期记忆库"，增删改/文档操作返回空成功，数据不真实 | `src/lib/adminApi.ts:195-204` | 对接真实后端接口（`aiService.knowledge.*` 已存在）或删除 |
| D-10 | 🟡 中 | 后台公安图标初始化不显示 | 初始化情况下后台未显示，前台正常 | 公安图标相关页面 | 排查初始化加载逻辑 |
| D-11 | 🟡 中 | 接口失败无友好弹窗 | 页面接口异常无提示，如知识库未配置向量化模型/重排模型时不可用但用户无感知 | 各业务页面 | 补充统一错误弹窗与可配置提示 |
| D-13（关联 A5） | ⚪ 低 | 控制台持续刷警告 | 每次页面加载重复输出 `No token found in localStorage, user-join event not emitted` | 前端事件上报逻辑 | 登录态判断改用 cookie，或未登录时不发该事件 |

---

## 十、代码与架构质量（BUG 表原 Q 组）

| 编号 | 等级 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| Q-01 | 🟡 中 | 提示词等配置存放于 env 文件 | AI 提示词在 env 中，无法线上灵活管理 | env 配置 | 改为数据库存储 |
| Q-02 | 🟡 中 | env 配置项冗余 | 配置项分散冗余，维护成本高 | env 配置 | 全量梳理整合 |
| Q-03 | 🟡 中 | 数据库存在多余无用表 | 结构不洁，增加维护与排查成本 | 数据库 | 清理无用表 |
| Q-04 | 🟡 中 | 聊天 SSE 逻辑两处重复且行为不一致 | header/abort/限流处理不同，易出兼容性 bug；`ChatWidget.tsx:6` 存在未使用 import | `page.tsx`（约300行）、`ChatWidget.tsx`（约170行） | 抽取共用 `useChatStream`/SSE 工具 |
| Q-05 | 🟡 中 | axios/fetch 混用，aiApi 不带 token、无 401 处理 | 请求能力不统一，鉴权失效/过期无统一处理 | `src/lib/aiApi.ts:9-14`、`api.ts`；`page.tsx:505`、`ChatWidget.tsx:149,243` | 统一客户端封装，统一 token/401 逻辑 |
| Q-06 | 🟡 中 | 首页 4 个模块区块近乎重复 | 产品/方案/案例/资源约 110 行重复 JSX | `page.tsx:972-1080` | 合并为单一渲染组件 |
| Q-07 | 🟡 中 | admin CRUD 页面样板重复 | 确认弹窗+loadData+表格+分页在各页重复实现 | users/roles/faqs/leads/content/home/about 等页面 | 抽取 AdminTable/ConfirmActions/Pagination 公共组件 |
| Q-08 | ⚪ 低 | 死代码与未使用配置 | `globals.css` 未被引用、`config.ai.sessionTimeout` 未使用、`homeProducts` 等状态未使用 | `config/index.ts:27`；`page.tsx:158-162` | 清理 |
| Q-09（关联 E-01） | ⚪ 低 | 大量硬编码中文未走 i18n | 国际化接入不全 | user-center/not-found/ChatWidget/ModuleDetailView/ModuleListView；`blockData.ts` | 公共页面全量接入 `t()` |

---

## 十一、样式与渲染（BUG 表原 R 组）

| 编号 | 等级 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- | --- |
| R-01 | ⚪ 低 | 样式不统一 | 89 处原生 `<img>`（无 lazy）、28 处内联 style | 全站；`next.config.js:6-8` 已 `images.unoptimized` | 统一 next/image + Tailwind 主题变量 |
| R-02 | ⚪ 低 | 全站静态导出但全部客户端拉接口 | `output:'export'`，无 SSR/SEO 渲染 | `next.config.js` | 确认架构意图；内容页考虑 SSG 预取 |

---

## 十二、部署与运维（BUG 表原 O 组）

| 编号 | 等级 | 问题项 | 现状与影响 | 整改建议 |
| --- | --- | --- | --- | --- |
| O-01 | ⚪ 低 | 缺少 Docker 方式部署说明 | 部署流程不完整 | 补充 Docker 部署文档/脚本 |
| O-02 | ⚪ 低 | 容器间互通未充分验证 | 前端/后端/Python 容器间需双向可访问，当前未系统验证 | 逐一验证并固化：后端↔前端、后端↔python、前端↔python |

---

## 十三、需求与体验（非缺陷，待排期）

| 编号 | 等级 | 事项 | 现状与说明 | 待确认/建议 |
| --- | --- | --- | --- | --- |
| E-01（关联 Q-09） | 🟡 中 | 中英文切换不完整 | 切换英文时 AI 回答仍为中文；全网站英文切换未完成 | 公共页面全量接入 i18n，AI 回答语言随界面语言切换 |
| E-02 | ⚪ 低 | 欢迎词/输入提示词字体字号不可配置 | 聊天欢迎词与输入提示词缺少字体字号配置 | 补充配置项 |
| E-03 | ⚪ 低 | 缺少 Demo 门户网站 | 演示门户未建设 | 需明确是否开放管理员账号；开放后前后台内容是否加访问限制 |
