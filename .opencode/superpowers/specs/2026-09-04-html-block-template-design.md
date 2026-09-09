# HTML代码展示类型 — 设计文档

日期：2026-09-04
状态：已评审

## 背景

后台内容组的展示类型（列表/模块/图文/时间线/富文本/轮播图）无法满足粘贴自定义 HTML 的需求。领导要求：在内容组类型下拉中新增「HTML代码」类型，支持粘贴 HTML 源码并在前台模块详情页原样渲染。

## 需求

1. 内容组展示类型下拉新增 `html`（HTML代码）选项。
2. 编辑器支持：源码编辑框 + 「源码/预览」切换（沙箱 iframe 预览）+「上传图片并插入」按钮。
3. 前台渲染：对 HTML 过滤危险内容后原样渲染。
4. 自动覆盖所有复用点：内容中心 `ContentForm`、首页区块 `BlockForm`、产品/方案/案例/资源弹窗 `BlockContentField`。

## 数据模型（无数据库改动）

新类型与其他展示组一致，存于 `extraData.sections[].data`：

```json
{ "sections": [{ "sectionType": "html", "data": { "html": "<div>...</div>" } }] }
```

## 设计

### 1. 类型注册 — `frontend/src/lib/blockData.ts`

- `BLOCK_TYPES` 增加：
  ```ts
  { type: 'html', label: 'HTML代码', desc: '粘贴 HTML 源码，前台原样渲染' }
  ```
- `validateBlockTypeData('html')`：源码去除标签后为空则报错，错误键 `html`，文案「HTML 代码不能为空」。
- `isSectionDataEmpty('html')`：同样按「去除标签后 trim 为空」判断。
- `parseContentSections` / `getRecordSectionType` 等通用逻辑零改动。

### 2. 安全过滤工具 — 新增 `frontend/src/lib/sanitizeHtml.ts`

导出 `sanitizeHtml(html: string): string`，基于 DOM 实现：

- 移除 `script / iframe / object / embed / link / style` 标签（含内容）。
- 移除所有 `on*` 事件属性。
- 过滤 `javascript:` 协议的 `href/src`。
- 编辑预览与前台渲染双端复用。

### 3. 编辑器 — `frontend/src/components/BlockTypeEditor.tsx`

新增 `renderHtmlForm()`：

- 等宽字体 `<textarea>` 编辑源码，数据字段 `data.html`。
- 工具栏：「源码/预览」分段切换（预览用 `iframe sandbox="" + srcDoc`，不执行脚本）；「上传图片并插入」按钮。
- 上传逻辑复用 `/upload` 接口（校验规则 `BLOCK_IMAGE_RULES`），拿到地址后经 `getImageUrl()` 转完整 URL，插入 `src` 光标处 `<img src="..." alt="" />`。
- 校验错误复用 `El`，错误键 `html`。

### 4. 前台渲染 — `frontend/src/components/BlockContent.tsx`

- 新增 `HtmlContent`：`dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.html) }}`，外层 `max-w-4xl mx-auto`。
- `switch` 增加 `case 'html'`。
- `ModuleDetailView.renderSections` 走 `BlockContent` 自动生效。

### 5. i18n — `frontend/src/i18n/messages.ts`

zh/en 的 `admin.ui.content.type` 字典补充 `html` 键（zh：HTML代码；en：HTML Code）。列表徽标由 `blockTypeLabel` 从 `BLOCK_TYPES` 自动覆盖。

### 6. 测试

- `blockData.test.ts`：新增 `html` 的 `validateBlockTypeData` 与 `isSectionDataEmpty` 用例。
- 新增 `sanitizeHtml.test.ts`：脚本/iframe/事件属性/javascript: 链接过滤用例。

## 验证

- `npx vitest run` 通过。
- `npm run lint`、`npx tsc --noEmit` 通过。
- 手工验证：后台内容组选「HTML代码」粘贴源码、预览、上传图片插入；前台详情页渲染且 script 不执行。