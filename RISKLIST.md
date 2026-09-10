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

> **特别说明：** 本清单用于辅助项目开发与质量管理，不构成对系统不存在安全漏洞或其他缺陷的保证。

---

## 一、凭据与机密泄露

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| A3 | 默认超级管理员 `admin/admin123` 未强制改密 | bcrypt 种子、README 公开该口令 | `backend/src/main/resources/sinounion.sql:649-651`；`README.md:72` | 首次登录强制改密 / 部署时校验弱口令 |
| A5（关联 BUG S-03、D-13） | JWT 存 `localStorage` + 非 HttpOnly/非 Secure cookie | logout 仅清浏览器，token 有效期内仍可用（无服务端吊销）；叠加 S-03 注入链路可被窃取登录态 | `frontend/src/hooks/useAuth.tsx:41-60,94-102`；`src/lib/api.ts:11` | token 改 httpOnly cookie；服务端 `tokenVersion`/黑名单吊销 |
| B4 / S-06 | CORS 全开放且配置重复 | `AllowedOriginPatterns("*")` + `allowCredentials=true`；`CorsConfig` 与 `SecurityConfig` 两套完全相同配置，均未改动 | `backend/.../config/CorsConfig.java:16-21`；`backend/.../config/SecurityConfig.java:33-43` | 限定允许来源白名单；删除其中一套重复定义 |
| A9 / D-12 | `localStorage` 解析无异常兜底 | `admin-layout.tsx:229-239` 已有 try/catch；但 `useAuth.tsx:47-48`、`useTracking.ts:72` 仍裸 `JSON.parse` | `useAuth.tsx:47-48`、`useTracking.ts:72` | 为剩余解析点增加异常兜底 |
| A6 / S-11 | 管理端 api-docs 运行时从第三方 CDN 加载 Swagger UI | 已为 unpkg 脚本/样式添加 `integrity`（SRI）与 `crossOrigin`；**残留**：仍为第三方 CDN，`persistAuthorization` 仍将 token 持久化到 localStorage | `frontend/src/app/admin/api-docs/page.tsx:45-46,54-55`（`persistAuthorization` 见 `:28`） | 改本地打包或固定版本 + SRI；移除 `persistAuthorization` |

---

## 二、认证与授权 / 接口暴露面

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| B3 | `/admin/forbidden-topics/**`、`/admin/faqs/**`、`/admin/related-content/**` 仅 `authenticated()` | 普通用户可改敏感词/FAQ/遍历内容 | 对应 `AdminForbiddenTopicController` / `AdminFaqController` / `AdminRelatedContentController` | 加角色级 `@PreAuthorize` |
| B6 | 短信验证码 6 位 + 5 分钟窗口无失败次数限制 | `send-code` 仅按手机号 60s 冷却、无 IP 维度，可短信轰炸/爆破 | `SmsService.java:64-73`；`AuthController.java:64-75` | IP 级限流 + 验证码错误次数上限 |
| S-02（关联 G5） | 访客统计接口匿名可读 | `/stats/**` permitAll，`GET /api/stats/dashboard` 匿名返回今日访问量等运营数据 | `SecurityConfig.java:79` | 移入 AdminStatsController 或加权限 |
| S-09（关联 G5） | 存在多余/未使用的公开接口，扩大攻击面 | Banner/Partner/IndustryChain/AboutSection/HomeSection 公开 Controller 与 Admin 侧重复且前端无调用；Lead CRUD 双份 | `/banners`、`/partners`、`/industry-chains`、`/about-sections`、`/home-sections`；`LeadController.java`、`controller/admin/AdminLeadController.java` | 全量排查并删除无用公开接口；Lead 合并为单一 Admin 控制器 |
| B7 | 无安全响应头 | 缺失 CSP/HSTS/`X-Content-Type-Options`/`X-Frame-Options`；CSRF 关闭（无状态 JWT 合理但响应头仍缺失） | `SecurityConfig.java:55-100` | 补充安全响应头 |
| B8 | 前端 admin 权限/角色缓存在登录快照 | 吊销/变更需重新登录才生效（Java 侧有强校验属显示层滞后；但对 Python AI 面是唯一闸门） | `useAuth.tsx:40-51`、`admin-layout.tsx:224-259` | 会话内按需重拉权限 / AI 面加服务端鉴权 |
| S-10 | 后台访问是否对外限制未明确 | 「网页是否限制访问后台」需求未落实；`/admin/**` 仍仅 JWT 鉴权，无内外网/来源限制 | 安全配置全局 | 明确内外网/角色访问策略并落实到 SecurityConfig |
| S-12 | `permitAll` 路径重复声明 | `/resources/**` 重复放行两次，规则冗余易误改 | `SecurityConfig.java:70` 与 `:82` | 去重 |

---

## 三、AI 服务（FastAPI `/ai`）控制面暴露

> 共性根因：`AI_consultant/api.py` 长期无任何认证，CORS 通配 + 携带凭据，FastAPI `/docs` 默认开启。**C5 已修复**：管理/破坏性接口现要求后端 JWT 或内部令牌（`AI_consultant/auth.py`）；但配置写入（C4）、会话/限流（C6/C7）、文档暴露（C8）等仍待处理，docker 配置仍强制监听 `0.0.0.0`。

| 编号 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| C4 | 可未授权改写模型 `base_url` 等配置 | POST `/model-config` 的写路径已移除（改为仅从 DB 重载）；**残留**：未鉴权的 `POST /ai/config` → `update_config` 仍可改写 `llm_base_url`/`llm_api_key`，仍可将真实 provider Key 发往攻击者服务器 | `AI_consultant/api.py:343-362,534-550`、`main.py` | `base_url`/system prompt 等写操作仅允许后端来源 |
| C6 | 跨用户共享 Redis `active_session` key | worker 重启/切换时可能续上他人会话；多 worker 下内存限流计数翻倍 | `AI_consultant/db.py:95-111`、`main.py:943-950`、`rate_limit.py:101-169` | 会话 key 绑定真实登录身份 |
| C7 | 限流可绕过 | guest 按 `visitor_id`/`session_id`、user 按请求体 `username` 计数，旋转即绕过"每日5次/每分钟30次"；Redis 故障降级为内存计数且 dict 无界增长 | `api.py:96-103`、`rate_limit.py:111-179` | 绑定服务端签发身份；限制字典增长 |
| C8 | `/docs`、`/openapi.json` 默认暴露；`migrate.py` 的 `drop_tables()` 无保护开关 | 接口文档/破坏性脚本可被访问 | `AI_consultant/api.py:72`、`migrate.py:25-28` | 生产关闭 docs；drop 加保护开关 |

---

## 四、XSS / 注入类（前端渲染 + 提示注入）

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| D3（关联 S-03） | `dangerouslySetInnerHTML` 渲染富文本/附件文档 HTML，无 DOMPurify 等清洗 | 后台编辑器仅对"粘贴"做纯文本化，拖拽/`insertHTML`/历史/导入内容仍可带事件属性；全仓无 DOMPurify | `BlockContent.tsx:214`、`ModuleDetailView.tsx`、`FilePreview.tsx:73` | 所有入库 HTML 统一用 DOMPurify 白名单清洗后再渲染 |
| D4 | 提示注入 | RAG 检索内容、用户记忆、附件文本被原样拼进 system prompt，无"内容≠指令"围栏；敏感词过滤仅作用于原始输入；上传与知识库数据源无鉴权可对共享 RAG 投毒 | `AI_consultant/main.py:1462-1486,887-899`、`api.py:113-125` | 内容与指令隔离；上传/知识库加鉴权与隔离 |

---

## 五、文件访问 / 路径穿越 / SSRF / 上传

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| E3 | 后端上传 `type` 参数未白名单校验 | 直接拼入存储/回显路径 | `backend/.../controller/UploadController.java:99` | type 白名单校验 |
| E4 | `ChatUploadController` 扩展名不校验 | 可存 `.html/.svg` 供浏览器执行（存储型 XSS 面）；无点文件名会 `StringIndexOutOfBoundsException` | `backend/.../controller/ChatUploadController.java:53-56` | 校验扩展名/MIME + 空文件名处理 |
| E5 | 前端"登录后可下载/预览"仅前端判断 | 后端 `/uploads/**`、`/files/**` 为公开，专属资料保护形同虚设 | `SecurityConfig.java:88-89`；`ModuleDetailView.tsx`；`lib/utils.ts` | 后端对受保护资源鉴权 |
| E6 | 附件/文档上传无大小上限与 MIME 白名单 | 后端 multipart 上限改为可配置、默认 8MB（`application.yml:33-34`）；**残留**：AI 侧附件/文档上传仍整文件 `read()`、无 MIME/页数/zip-bomb 限制，且 `docker-compose.yml` 又把上限覆盖回 50/100MB | `AI_consultant/api.py:874-911`、`knowledge.py:443-472` | 限制大小/MIME、流式解析与 zip-bomb 防护；统一 compose 覆盖值 |
| D5 | `images` 接受任意 URL 交由视觉模型服务端抓取 | 内容传输给第三方/内网探测（SSRF 面） | `AI_consultant/main.py:1170-1177` | URL 白名单或禁公网抓取 |

---

## 六、加密 / 密钥实现

| 编号 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| F1 | AES 主密钥未配置时启动自动生成并**写回被 git 追踪的 `.env`** | 仍会自动生成并回写 `.env`（`SecretCryptoService.java:119-138`）；因 `.env` 已不再被 git 追踪，不再随仓库入库 | `SecretCryptoService.java:87-99,119-138` | 密钥改注入/密钥管理系统，禁止回写文件 |
| F2 | AES 密钥派生：非 Base64/非法长度回退裸 SHA-256（无 KDF/盐） | 弱口令可暴力；Python lenient `b64decode` 与 Java 严格解析对含空白 Base64 得出不同密钥 → 解密失败难排查 | `SecretCryptoService.java:105-117`、`AI_consultant/main.py:196-226` | 统一 KDF 与 Base64 解析规则 |
| F3 | RSA 传输密钥对每次重启重新生成且不持久化 | 跨重启的 RSA 加密值失效（前端须每次重取公钥）；公钥可公开却挂在 `page:config:view` 权限后 | `SecretCryptoService.java:66-74,272-279` | 密钥对持久化；公钥独立下发 |
| F4 | RSA 解密对无界输入执行 | 增加了解密后长度告警与异常日志（`SecretCryptoService.java:259-274`）；**残留**：入参仍无长度上限，大载荷 RSA 运算 DoS 面仍在 | `SecretCryptoService.java:248-274` | 限制密文长度 |
| F5 | `SecretConfigMigrationRunner` 吞掉所有异常并跳过迁移 | 明文敏感项可能静默残留未加密 | `SecretConfigMigrationRunner.java:58-60` | 记录并告警失败项 |

---

## 七、安全配置 / 依赖 / 部署资产

| 编号(来源) | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| G1 | Spring Boot **2.7.18 已 EOL** | 无安全补丁，目标 Java 1.8 | `backend/pom.xml:10` | 升级受支持版本 |
| G3 | 无 CSP/安全头且站点含多存储型 XSS 面 | 失去最后防线；`next.config.js` 无 `headers()`，静态导出亦无法施加 | `frontend/next.config.js:1-21` | 补 CSP 等安全头（服务端代理层施加） |
| B5 | SpringDoc Swagger 在生产主配置开启 | `/swagger-ui/**`、`/v3/api-docs/**` 等已要求 `system:api-docs:view` 权限（`SecurityConfig.java:93-97`）；**残留**：`springdoc` 仍在主配置启用，未按 profile 关闭 | `backend/src/main/resources/application.yml:67-72` | 生产 profile 关闭 |
| G2 | Next.js 15.3.3 版本偏旧 | 非最新 15.x 安全补丁 | `frontend/package.json` | 升级到最新 15.x |
| G4 | 生成型 SEO 文件全站文本对 AI 爬虫开放；域名不一致 | SEO 文件已重新生成，但改为指向**内网地址** `http://192.168.0.68:3200`（泄露内网信息，见 N-02），且与 `layout.tsx`/`seo.ts` 的 `www.example.cn` 仍不一致 | `frontend/public/robots.txt`、`sitemap.xml`、`llms*.txt`、`src/lib/seo.ts` | 统一为对外域名；评估 SEO 文件访问策略 |
| G5（关联 S-02、S-09） | 前台公开 `/seo/**`、`/stats/**`、`/ai/**`、`/upload/**` 等宽泛放行 | 需逐一确认各控制器是否需鉴权 | `SecurityConfig.java:62-90` | 逐接口最小化放行 |
| G6 | 测试产物与二进制入库 | `frontend/test-results/.last-run.json` 仍被追踪；大体积 `ip2region.xdb`（约 11MB）仍入库 | git 追踪列表 | 移出追踪、完善 .gitignore |

---

## 八、代码缺陷（健壮性 / 并发 / 逻辑）

| 编号 | 风险项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| H1 | `LeadServiceImpl.assignLead/updateLeadStatus` 对不存在的 id 直接解引用 → NPE 500 | 应 404 | `backend/.../service/impl/LeadServiceImpl.java:185-197` | 判空返回 404 |
| H4 | `.env` 在线改写非原子（整文件重写、丢注释/引号） | 与启动时 `persistAesKeyToEnv` 存在并发写冲突 | `AdminEnvConfigController.java:166-194` | 原子化/串行化写入 |
| H5 | Python 每个 `/ai/chat` 一个 daemon 线程 + 共享 4-worker 线程池无信号量 | Token 记录每调用一线程 + 无界缓存 dict；断连仅按块检查 stop → 高并发线程/内存耗尽 | `AI_consultant/api.py:216`、`main.py:1488-1493` | 有界线程池/信号量、清理缓存 |
| H6 | 运行时用共享特权 DB 账号执行 DDL（`CREATE EXTENSION vector`、`ALTER … embedding TYPE vector(dim)`） | 生产表锁/整表重写 | `AI_consultant/knowledge.py:566-589`、`main.py` | 迁移与运行账号分离 |
| H2 | `AdminRelatedContentController.batch` 对非数字 `ids` 抛 `NumberFormatException` → 500 并回显 | 应 400 | `AdminRelatedContentController.java:53-56` | 参数校验 |
| H3 | `AuthController /auth/me` 用户被删后 `user` 为 null → NPE | 应 401/404 | `AuthController.java:57-61` | 判空 |
| H7 | `db.py` `int(DB_PORT)` 于 import 时报错崩溃；Redis 助手吞连接异常返回 `None` | 调用方须处处判空（已导致限流/会话降级行为） | `AI_consultant/db.py:20-33,88-111` | 启动校验配置；连接失败明确报错 |
| H8 | `AdminEnvConfigController` / `AdminConfigFileController` 允许在线写任意 `application.yml`/`.env` 内容 | config 权限持有者 ≈ 配置篡改/近 RCE 面，仅靠固定路径约束 | `AdminConfigFileController.java:63-77` | 收紧权限与内容校验、审计日志 |

---

## 九、数据与功能缺陷

| 编号 | 缺陷项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| D-01 | 线索中文乱码 | 表单姓名/来源页以 GB18030 字节写入 DB，接口按 UTF-8 返回，前端显示乱码；仅线索相关数据受影响 | `GET /api/leads`（name="超级管理"、sourcePage="测试视频1" 均乱码） | 统一请求/存储编码为 UTF-8，排查表单提交链路与 JDBC 连接编码 |
| D-02 | 线索所属地无法正确显示 | 线索管理中 IP→属地解析缺失或错误 | 线索管理相关页面 | 参考 https://ipwho.is/ 完善属地解析 |
| D-03 | 业务接口返回码与提示文案不统一 | 返回 code 400、文案 `duplicate_submission`，前端难映射友好提示 | `LeadController.java:55/61/68` | 统一错误码规范，前端映射友好弹窗 |
| D-04 | 知识库未分组、对话全量检索 | 开启知识库后每次对话全量使用库内容，成本高、精度差 | 知识库模块 | 知识库按模块拆分，AI 对话按分类读取 |
| D-05 | 模块详情在线预览部分格式无法渲染 | pdf/md 无法正常预览（本次仅为预览组件抽取渲染 helper，未扩展格式） | 模块详情页在线预览 | 支持 pdf/md/docx/txt/excel 等格式展示 |
| D-06 | 数据库导入导出异常 | 使用 Navicat 等工具导入导出出现数据无法导入 | 数据库运维 | 支持通过可视化工具快速导入/备份数据 |
| D-07 | 数据库无法实时保存，存在配置丢失风险 | 填写配置后未及时落盘 | 配置/持久化链路 | 每填一项即备份 env/数据库/持久化文件（保留近 1 小时）+ 每晚备份策略 |
| D-08 | 内容无法切换历史版本 | 内容缺少版本管理/回滚能力 | 内容管理模块 | 补充历史版本记录与切换能力 |
| D-10 | 后台公安图标初始化不显示 | 初始化情况下后台未显示，前台正常 | 公安图标相关页面 | 排查初始化加载逻辑 |
| D-11 | 接口失败无友好弹窗 | 页面接口异常无提示，如知识库未配置向量化模型/重排模型时不可用但用户无感知 | 各业务页面 | 补充统一错误弹窗与可配置提示 |

---

## 十、代码与架构质量

| 编号 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| Q-01 | 提示词等配置存放于 env 文件 | AI 提示词在 env 中，无法线上灵活管理 | env 配置 | 改为数据库存储 |
| Q-02 | env 配置项冗余 | 配置项分散冗余，维护成本高 | env 配置 | 全量梳理整合 |
| Q-03 | 数据库存在多余无用表 | 结构不洁，增加维护与排查成本 | 数据库 | 清理无用表 |
| Q-04 | 聊天 SSE 逻辑两处重复且行为不一致 | 两处 SSE 各自抽取了 helper，但仍是两套实现且行为不一致（`ChatWidget` 缺少限流/访客配额/abort 处理） | `(public)/page.tsx`、`ChatWidget.tsx` | 抽取共用 `useChatStream`/SSE 工具 |
| Q-05 | axios/fetch 混用，aiApi 不带 token、无 401 处理 | 请求能力不统一，鉴权失效/过期无统一处理 | `src/lib/aiApi.ts:1-16`、`api.ts` | 统一客户端封装，统一 token/401 逻辑 |
| Q-06 | 首页 4 个模块区块近乎重复 | 产品/方案/案例/资源约 110 行重复 JSX（仍为 4 个独立 render 函数） | `(public)/page.tsx:953-1061` | 合并为单一渲染组件 |
| Q-07 | admin CRUD 页面样板重复 | 确认弹窗+loadData+表格+分页在各页重复实现 | users/roles/faqs/leads/content/home/about 等页面 | 抽取 AdminTable/ConfirmActions/Pagination 公共组件 |
| Q-08 | 死代码与未使用配置 | `src/styles/globals.css` 未被引用、`config.ai.sessionTimeout` 未使用、`homeProducts` 等状态未使用 | `config/index.ts:32`；`(public)/page.tsx:399,514` | 清理 |
| Q-09（关联 E-01） | 大量硬编码中文未走 i18n | 权限管理页已接入 i18n（`i18n/messages.ts` 新增权限文案）；首页与多数组件仍硬编码中文 | `user-center/not-found/ChatWidget/ModuleDetailView/ModuleListView`；`blockData.ts` | 公共页面全量接入 `t()` |

---

## 十一、样式与渲染

| 编号 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| R-01 | 样式不统一 | 89 处原生 `<img>`（无 lazy）、28 处内联 style | 全站；`next.config.js:6-8` 已 `images.unoptimized` | 统一 next/image + Tailwind 主题变量 |
| R-02 | 全站静态导出但全部客户端拉接口 | `output:'export'`，无 SSR/SEO 渲染 | `next.config.js:3` | 确认架构意图；内容页考虑 SSG 预取 |

---

## 十二、部署与运维

| 编号 | 问题项 | 现状与影响 | 整改建议 |
| --- | --- | --- | --- |
| O-01 | 缺少 Docker 方式部署说明 | 部署流程不完整（README 未补充生产 Compose 部署章节） | 补充 Docker 部署文档/脚本 |
| O-02 | 容器间互通未充分验证 | `docker-compose.yml` 已增加 `AI_HOST=0.0.0.0`、healthcheck 与 `depends_on`；**残留**：未做实际连通性验证 | 逐一验证并固化：后端↔前端、后端↔python、前端↔python |

---

## 十三、需求与体验（非缺陷，待排期）

| 编号 | 事项 | 现状与说明 | 待确认/建议 |
| --- | --- | --- | --- |
| E-01（关联 Q-09） | 中英文切换不完整 | 权限管理页已补 i18n；切换英文时 AI 回答仍为中文，全网站英文切换未完成 | 公共页面全量接入 i18n，AI 回答语言随界面语言切换 |
| E-02 | 欢迎词/输入提示词字体字号不可配置 | 聊天欢迎词与输入提示词缺少字体字号配置 | 补充配置项 |
| E-03 | 缺少 Demo 门户网站 | 演示门户未建设 | 需明确是否开放管理员账号；开放后前后台内容是否加访问限制 |

---

## 十四、本次修订新增观察项

> 以下为本次核验（当前工作区）中新识别、或由本次改动引入的问题，供后续排期参考。

| 编号 | 问题项 | 现状与影响 | 问题位置 | 整改建议 |
| --- | --- | --- | --- | --- |
| N-01（关联 A8） | `encryptSecret` 在非安全上下文静默回退明文传输 | `secretCrypto.ts:26-30` 在 `crypto.subtle` 不可用（HTTP）时直接返回明文，敏感密钥经明文请求体传输；仅在 HTTPS 下才真正加密 | `frontend/src/lib/secretCrypto.ts:26-30` | 强制 HTTPS；非安全上下文应报错而非静默降级 |
| N-02（关联 G4） | SEO 生成文件指向内网地址 | `robots.txt`/`sitemap.xml`/`llms*.txt` 被重新生成为 `http://192.168.0.68:3200`，向外部暴露内网 IP 且与站点域名不一致 | `frontend/public/robots.txt`、`sitemap.xml`、`llms.txt`、`llms-full.txt` | 生成时注入对外域名；避免提交内网地址 |
| N-03（关联 C1/C4） | 新增未鉴权 AI 管理/连通性接口 | 新增 `/ai/md/*` 与 `/model-config/test` 等路由均无鉴权；测试端点会把已配置的 API Key 转发至配置的 `base_url` | `AI_consultant/api.py`、`ai_md.py` | 统一鉴权；测试端点限制来源与目标白名单 |
| N-04（关联 E6） | compose 覆盖上传上限 | `application.yml` 默认 8MB，但 `docker/docker-compose.yml` 又覆盖为 50MB/100MB，使默认收紧失效 | `docker/docker-compose.yml` | 统一上限策略并说明 |
