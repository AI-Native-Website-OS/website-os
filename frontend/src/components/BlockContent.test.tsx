import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { BlockContent } from './BlockContent';

beforeAll(() => {
  (globalThis as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = '';
    thresholds = [];
  };
});

describe('BlockContent html', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the raw html inside an iframe with scripts allowed', () => {
    const { container } = render(
      <BlockContent type="html" data={{ html: '<h2>标题</h2><p>正文</p><script>alert(1)</script>' }} />
    );
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
    expect(iframe.getAttribute('sandbox')).toContain('allow-same-origin');
    expect(iframe.srcdoc).toContain('<h2>标题</h2>');
    expect(iframe.srcdoc).toContain('正文');
    expect(iframe.srcdoc).toContain('<script>alert(1)</script>');
  });

  it('keeps event handler attributes and nested iframes untouched', () => {
    const { container } = render(
      <BlockContent type="html" data={{ html: '<button onclick="hack()">点我</button><iframe src="https://example.com"></iframe>' }} />
    );
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.srcdoc).toContain('onclick="hack()"');
    expect(iframe.srcdoc).toContain('<iframe');
  });
});