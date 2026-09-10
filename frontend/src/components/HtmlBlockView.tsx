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
 *
 * 同时负责把内容实际尺寸通过 postMessage 上报给父页面：iframe 处于沙箱（无 allow-same-origin）
 * 时父页面无法读取 contentDocument，只能依赖该消息完成自动高度/宽度测量。
 */
export const VH_FIX_SCRIPT = `(function () {
  var base = (typeof window.__HTML_BLOCK_VIEWPORT_HEIGHT === 'number' && window.__HTML_BLOCK_VIEWPORT_HEIGHT > 0)
    ? window.__HTML_BLOCK_VIEWPORT_HEIGHT : 900;
  try {
    if (base === 900 && window.parent && window.parent.innerHeight) base = window.parent.innerHeight;
  } catch (e) {}
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

  var report = function () {
    try {
      var de = document.documentElement;
      var body = document.body;
      var h = Math.max(de ? de.scrollHeight : 0, body ? body.scrollHeight : 0);
      var w = Math.max(de ? de.scrollWidth : 0, body ? body.scrollWidth : 0);
      window.parent.postMessage({ type: 'html-block-size', height: h, width: w }, '*');
    } catch (e) {}
  };
  report();
  window.addEventListener('load', report);
  window.addEventListener('resize', report);
  if (window.ResizeObserver) {
    try { new ResizeObserver(report).observe(document.documentElement); } catch (e) {}
  }
  if (window.MutationObserver) {
    try {
      new MutationObserver(report).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, characterData: true,
      });
    } catch (e) {}
  }
  setInterval(report, 800);
})();`;

/** 将 vh 修正脚本注入 html 文档（完整文档插入 </body> 前，片段则追加到末尾）。 */
export function buildVhFixedDoc(html: string, viewportHeight?: number): string {
  const prelude = viewportHeight && viewportHeight > 0
    ? `window.__HTML_BLOCK_VIEWPORT_HEIGHT=${Math.round(viewportHeight)};`
    : '';
  const script = `<script>${prelude}${VH_FIX_SCRIPT}</script>`;
  const lower = html.toLowerCase();
  if (lower.includes('</body>')) return html.replace(/<\/body>/i, `${script}</body>`);
  if (lower.includes('</html>')) return html.replace(/<\/html>/i, `${script}</html>`);
  return html + script;
}

/**
 * HTML 代码块渲染组件。
 * 将粘贴的 HTML 源码放入 iframe（srcDoc）渲染，不套站点样式、不过滤标签/属性/脚本，
 * 但通过 sandbox 隔离：脚本以不透明源（opaque origin）执行，无法访问同源 localStorage/Cookie，
 * 从而无法读取父页面的登录态（JWT）。iframe 高度/宽度由注入脚本 postMessage 上报后自适应。
 * 前台渲染与后台编辑器「预览」共用本组件，保证所见即所得。
 */
export function HtmlBlockView({ html }: HtmlBlockViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const docWidthRef = useRef<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number | undefined>(undefined);
  const [docWidth, setDocWidth] = useState<number | null>(null);
  const [docHeight, setDocHeight] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const srcDoc = useMemo(() => buildVhFixedDoc(html, viewportHeight), [html, viewportHeight]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerHeight > 0) {
      setViewportHeight(window.innerHeight);
    }
  }, []);

  useEffect(() => {
    docWidthRef.current = null;
    setDocWidth(null);
    setScale(1);
    setDocHeight(null);
    setReady(false);
  }, [html]);

  const applySize = useCallback((contentWidth: number, contentHeight: number) => {
    const wrap = wrapRef.current;
    if (!wrap || contentHeight <= 0) return;
    const cw = wrap.clientWidth;
    if (cw <= 0) return;
    const design = docWidthRef.current;
    if (design == null) {
      if (contentWidth > cw + 2) {
        docWidthRef.current = contentWidth;
        setDocWidth(contentWidth);
        setScale(Math.min(1, cw / contentWidth));
      } else {
        setDocWidth(null);
        setScale(1);
      }
    } else if (contentWidth > design + 2) {
      docWidthRef.current = contentWidth;
      setDocWidth(contentWidth);
      setScale(Math.min(1, cw / contentWidth));
    } else if (contentWidth <= cw + 2) {
      docWidthRef.current = null;
      setDocWidth(null);
      setScale(1);
    }
    setDocHeight(contentHeight);
    setReady(true);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const node = iframeRef.current;
      if (!node || e.source !== node.contentWindow) return;
      const d = e.data;
      if (d && d.type === 'html-block-size') {
        applySize(Number(d.width) || 0, Number(d.height) || 0);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [applySize]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const design = docWidthRef.current;
      if (design != null && wrap.clientWidth > 0) {
        setScale(Math.min(1, wrap.clientWidth / design));
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden"
      style={{ height: ready && docHeight != null ? docHeight * scale : undefined, minHeight: 120 }}
    >
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-modals"
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
