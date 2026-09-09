import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react';
import BlockTypeEditor from './BlockTypeEditor';
import { BLOCK_IMAGE_RULES } from '@/lib/uploadRules';

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: { post: vi.fn() },
}));

beforeAll(() => {
  class FakeImage {
    naturalWidth = 1921;
    naturalHeight = 801;
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      setTimeout(() => this.onload?.(), 0);
    }
  }
  (globalThis as any).Image = FakeImage;
});

describe('BlockTypeEditor html', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a source textarea pre-filled with data.html', () => {
    const { container } = render(<BlockTypeEditor type="html" data={{ html: '<p>hi</p>' }} errors={{}} updateData={vi.fn()} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe('<p>hi</p>');
  });

  it('updates data.html while typing', () => {
    const updateData = vi.fn();
    const { container } = render(<BlockTypeEditor type="html" data={{ html: '' }} errors={{}} updateData={updateData} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '<div>x</div>' } });
    expect(updateData).toHaveBeenCalledWith('html', '<div>x</div>');
  });

  it('shows validation error for the html key', () => {
    render(<BlockTypeEditor type="html" data={{ html: '' }} errors={{ html: 'HTML 代码不能为空' }} updateData={vi.fn()} />);
    expect(screen.getByText('HTML 代码不能为空')).toBeTruthy();
  });

  it('toggling to preview renders the raw html in an iframe with scripts allowed', () => {
    const { container } = render(
      <BlockTypeEditor type="html" data={{ html: '<p>ok</p><script>alert(1)</script>' }} errors={{}} updateData={vi.fn()} />
    );
    fireEvent.click(screen.getByText('预览'));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
    expect(iframe.srcdoc).toContain('<p>ok</p>');
    expect(iframe.srcdoc).toContain('<script>alert(1)</script>');
  });

  it('uploading an image in html mode does not enforce the 1920x800 dimension rule', async () => {
    const { default: api } = await import('@/lib/api');
    (api.post as any).mockResolvedValue({ code: 200, data: { url: '/uploads/x.jpg' } });
    const updateData = vi.fn();
    const { container } = render(
      <BlockTypeEditor type="html" data={{ html: '' }} errors={{}} updateData={updateData} imageRules={BLOCK_IMAGE_RULES} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(updateData).toHaveBeenCalledWith('html', expect.stringContaining('<img src="'));
  });

  it('inserts the image tag even when the source textarea is not mounted (preview mode)', async () => {
    const { default: api } = await import('@/lib/api');
    (api.post as any).mockResolvedValue({ code: 200, data: { url: '/uploads/y.jpg' } });
    const updateData = vi.fn();
    const { container } = render(
      <BlockTypeEditor type="html" data={{ html: '<p>已有</p>' }} errors={{}} updateData={updateData} />
    );
    fireEvent.click(screen.getByText('预览'));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(updateData).toHaveBeenCalledWith('html', expect.stringContaining('<img src="'));
  });
});

describe('BlockTypeEditor carousel', () => {
  afterEach(() => {
    cleanup();
  });

  it('deleting a carousel image removes it without duplicating remaining items', () => {
    const updateData = vi.fn();
    const data = {
      items: [
        { image: 'a.jpg' },
        { image: 'b.jpg' },
        { image: 'c.jpg' },
      ],
      autoPlay: true,
      interval: 3,
    };

    const { container } = render(<BlockTypeEditor type="carousel" data={data} errors={{}} updateData={updateData} />);
    const deleteButtons = Array.from(container.querySelectorAll('.relative.group button'));
    expect(deleteButtons.length).toBe(3);

    fireEvent.click(deleteButtons[0]);

    expect(updateData).toHaveBeenCalled();
    const lastCall = updateData.mock.calls[updateData.mock.calls.length - 1];
    expect(lastCall[0]).toBe('items');
    expect(lastCall[1]).toHaveLength(2);
    expect(lastCall[1]).toEqual([{ image: 'b.jpg' }, { image: 'c.jpg' }]);
  });
});

describe('BlockTypeEditor optional fields', () => {
  afterEach(() => {
    cleanup();
  });

  it('module description is no longer marked as required', () => {
    const { container } = render(
      <BlockTypeEditor
        type="module"
        data={{ items: [{ title: '模块A', subtitle: '', icon: '', description: '' }] }}
        errors={{}}
        updateData={vi.fn()}
      />
    );
    const labels = Array.from(container.querySelectorAll('label'));
    const descLabel = labels.find((l) => l.textContent?.includes('模块描述'));
    expect(descLabel?.textContent).not.toContain('*');
  });

  it('image description is no longer marked as required', () => {
    const { container } = render(
      <BlockTypeEditor
        type="image_text"
        data={{ groups: [{ image: '', description: '' }] }}
        errors={{}}
        updateData={vi.fn()}
      />
    );
    const labels = Array.from(container.querySelectorAll('label'));
    const descLabel = labels.find((l) => l.textContent?.includes('图片描述'));
    expect(descLabel?.textContent).not.toContain('*');
  });

  it('timeline content is no longer marked as required', () => {
    const { container } = render(
      <BlockTypeEditor
        type="timeline"
        data={{ timeline: [{ date: '', content: '', tag: '' }] }}
        errors={{}}
        updateData={vi.fn()}
      />
    );
    const labels = Array.from(container.querySelectorAll('label'));
    const descLabel = labels.find((l) => l.textContent?.includes('描述内容'));
    expect(descLabel?.textContent).not.toContain('*');
  });
});
