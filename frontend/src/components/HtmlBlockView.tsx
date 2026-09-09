'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface HtmlBlockViewProps {
  html: string;
}

/**
 * 注入 iframe 文档的脚本：将内容中所有 vh 单位改写为基于父页面视口高度的固定像素值。
 * 解决「自适应高度 iframe + vh 布局」的正反馈循环：
 * iframe 高度由内容高度决定，而 vh 又相对 iframe 自身高度解析 → 高度被不断拉高。
 * 改写后 vh 变为常量，循环打破，同时保持「首屏撑满」的视觉效果（相对真实页面视口）。
 */
export const VH_FIX_SCRIPT = `(function () {
  var base = 900;
  try { base = window.parent && window.parent.innerHeight ? window.parent.innerHeight : 900; } catch (e) {}
  var unit = base / 100;
  var toPx = function (v) {
    return v.replace(/(-?[\\d.]+)vh\\b/gi, function (_, n) { return parseFloat(n) * unit + 'px'; });
  };
  var fixStyle = function (style) {
    for (var i = 0; i < style.length; i++) {
      var p = style[i];
      var v = style.getPropertyValue(p);
      if (v && /(^|[^a-z])vh\\b/i.test(v)) style.setProperty(p, toPx(v), style.getPropertyPriority(p));
    }
  };
  var fixSheet = function (sheet) {
    try {
      var rules = sheet.cssRules;
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.style) fixStyle(r.style);
        if (r.cssRules) fixSheet(r);
      }
    } catch (e) {}
  };
  for (var s = 0; s < document.styleSheets.length; s++) fixSheet(document.styleSheets[s]);
  document.querySelectorAll('[style]').forEach(function (el) { fixStyle(el.style); });
  if (window.MutationObserver) {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (n.nodeType === 1) {
            if (n.getAttribute && n.getAttribute('style')) fixStyle(n.style);
            if (n.querySelectorAll) n.querySelectorAll('[style]').forEach(function (el) { fixStyle(el.style); });
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();`;

/** 将 vh 修正脚本注入 html 文档（完整文档插入 </body> 前，片段则追加到末尾）。 */
export function buildVhFixedDoc(html: string): string {
  const script = `<script>${VH_FIX_SCRIPT}</script>`;
  const lower = html.toLowerCase();
  if (lower.includes('</body>')) return html.replace(/<\/body>/i, `${script}</body>`);
  if (lower.includes('</html>')) return html.replace(/<\/html>/i, `${script}</html>`);
  return html + script;
}

/**
 * HTML 代码块渲染组件。
 * 将粘贴的 HTML 源码原样放入 iframe（srcDoc）渲染，不套站点样式、不过滤任何标签/属性/脚本，
 * 脚本以同源权限执行，效果与本地浏览器打开一致。
 * iframe 高度按内容自动撑开，仅作为页面内容区的一个区块展示。
 * 当内容宽度超过容器宽度时，按比例整体缩放以完整展示，不出现横向滚动条。
 * 前台渲染与后台编辑器「预览」共用本组件，保证所见即所得。
 */
export function HtmlBlockView({ html }: HtmlBlockViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const observerCleanupRef = useRef<(() => void) | null>(null);
  const docWidthRef = useRef<number | null>(null);
  const [docWidth, setDocWidth] = useState<number | null>(null);
  const [docHeight, setDocHeight] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const srcDoc = useMemo(() => buildVhFixedDoc(html), [html]);

  const measure = useCallback(() => {
    const node = iframeRef.current;
    const wrap = wrapRef.current;
    if (!node || !wrap) return;
    const cw = wrap.clientWidth;
    if (cw <= 0) return;
    let doc: Document | null = null;
    try {
      doc = node.contentDocument;
    } catch {
      /* 跨域/沙箱限制时静默跳过 */
    }
    if (!doc || !doc.documentElement) return;
    const de = doc.documentElement;
    const sh = de.scrollHeight;
    const sw = de.scrollWidth;

    if (docWidthRef.current == null) {
      // 自然渲染：按容器宽度布局，若内容未超宽则直接展示
      if (sw <= cw + 2) {
        setDocWidth(null);
        setScale(1);
        if (sh > 0) {
          setDocHeight(sh);
          setReady(true);
        }
      } else {
        // 内容超宽：锁定设计宽度，切换 iframe 宽度后重测
        docWidthRef.current = sw;
        setDocWidth(sw);
        requestAnimationFrame(measure);
      }
      return;
    }

    // 缩放渲染：内容按设计宽度布局后整体缩放至容器宽度
    const design = docWidthRef.current;
    if (sw > design + 2) {
      docWidthRef.current = sw;
      setDocWidth(sw);
      requestAnimationFrame(measure);
      return;
    }
    const s = cw / design;
    if (s >= 1) {
      // 容器已足够宽，退回自然渲染
      docWidthRef.current = null;
      setDocWidth(null);
      setScale(1);
      requestAnimationFrame(measure);
      return;
    }
    setScale(s);
    if (sh > 0) {
      setDocHeight(sh);
      setReady(true);
    }
  }, []);

  const attachObserver = useCallback(() => {
    const node = iframeRef.current;
    if (!node) return;
    observerCleanupRef.current?.();
    observerCleanupRef.current = null;
    try {
      const doc = node.contentDocument;
      if (doc && doc.body) {
        const mo = new MutationObserver(() => measure());
        mo.observe(doc.body, { childList: true, subtree: true, attributes: true, characterData: true });
        observerCleanupRef.current = () => mo.disconnect();
      }
    } catch {
      /* ignore */
    }
  }, [measure]);

  useEffect(() => {
    const node = iframeRef.current;
    if (!node) return;
    const onLoad = () => {
      measure();
      attachObserver();
    };
    node.addEventListener('load', onLoad);
    if (node.contentDocument && node.contentDocument.readyState === 'complete') {
      measure();
      attachObserver();
    }
    return () => {
      node.removeEventListener('load', onLoad);
      observerCleanupRef.current?.();
      observerCleanupRef.current = null;
    };
  }, [measure, attachObserver]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const timer = window.setInterval(measure, 800);
    return () => window.clearInterval(timer);
  }, [measure]);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden"
      style={{ height: ready && docHeight != null ? docHeight * scale : undefined, minHeight: 120 }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
        title="HTML 内容"
        className="border-0 bg-white"
        style={{
          width: docWidth != null ? docWidth : '100%',
          height: docHeight ?? undefined,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          visibility: ready ? 'visible' : 'hidden',
          display: 'block',
        }}
      />
    </div>
  );
}