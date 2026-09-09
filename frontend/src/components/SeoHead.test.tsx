import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import SeoHead from './SeoHead';

vi.mock('next/head', () => ({
  __esModule: true,
  default: () => null,
}));

const mockApiGet = vi.fn();

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}));

beforeEach(() => {
  mockApiGet.mockResolvedValue({ data: null });
});

afterEach(() => {
  cleanup();
  document.title = '';
  document.querySelector('head title')?.remove();
  mockApiGet.mockReset();
});

describe('SeoHead', () => {
  it('sets document.title to fullTitle on mount', () => {
    render(<SeoHead title="产品中心" path="/list/category" />);
    expect(document.title).toBe('产品中心 - 圣诺联合');
  });

  it('keeps title as-is when it already contains the site name', () => {
    render(<SeoHead title="圣诺联合 - 产品中心" path="/list/category" />);
    expect(document.title).toBe('圣诺联合 - 产品中心');
  });

  it('re-applies document.title when Next.js overwrites it', async () => {
    render(<SeoHead title="登录" path="/login" />);
    document.title = '登录 - 圣诺江苏官网';
    await new Promise((r) => setTimeout(r, 20));
    expect(document.title).toBe('登录 - 圣诺联合');
  });

  it('updates document.title when the title prop changes', () => {
    const { rerender } = render(<SeoHead title="产品中心" path="/list/category" />);
    rerender(<SeoHead title="解决方案" path="/list/category" />);
    expect(document.title).toBe('解决方案 - 圣诺联合');
  });

  it('fetches config by URL and overrides title', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        id: 1,
        pageType: null,
        pageId: null,
        title: '首页 - 圣诺联合动态标题',
        description: '来自数据库的动态描述',
        keywords: '',
        canonicalUrl: 'https://www.example.cn/',
        ogTitle: '',
        ogDescription: '',
        ogImage: '',
      },
    });
    render(<SeoHead title="企业数字基础设施服务商" description="硬编码描述" path="/" />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/seo', expect.objectContaining({ params: { url: 'https://www.example.cn/', pageId: undefined } })));
    await waitFor(() => expect(document.title).toBe('首页 - 圣诺联合动态标题'));
  });

  it('keeps hardcoded values when fetch returns no config', async () => {
    mockApiGet.mockResolvedValue({ data: null });
    render(<SeoHead title="关于我们" path="/about" />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/seo', expect.objectContaining({ params: { url: 'https://www.example.cn/about', pageId: undefined } })));
    await waitFor(() => expect(document.title).toBe('关于我们 - 圣诺联合'));
  });

  it('passes pageId to the request when provided', async () => {
    mockApiGet.mockResolvedValue({ data: null });
    render(<SeoHead title="产品详情" path="/list/detail" pageId={42} />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/seo', expect.objectContaining({ params: { url: 'https://www.example.cn/list/detail', pageId: 42 } })));
  });

  it('keeps hardcoded values when the fetch fails', async () => {
    mockApiGet.mockRejectedValue(new Error('network'));
    render(<SeoHead title="FAQ" path="/faqs" />);
    await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
    await waitFor(() => expect(document.title).toBe('FAQ - 圣诺联合'));
  });
});