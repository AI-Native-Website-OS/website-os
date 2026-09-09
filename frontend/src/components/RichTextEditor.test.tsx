import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import RichTextEditor from './RichTextEditor';

describe('RichTextEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not reset innerHTML when value already matches the DOM during typing', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RichTextEditor value="" onChange={onChange} />);
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;

    editor.innerHTML = 'ab';
    fireEvent.input(editor);
    expect(onChange).toHaveBeenCalledWith('ab');

    let setCalls = 0;
    const current = editor.innerHTML;
    Object.defineProperty(editor, 'innerHTML', {
      get() { return (this as any).__innerHTML; },
      set(v: string) { setCalls++; (this as any).__innerHTML = v; },
      configurable: true,
    });
    (editor as any).__innerHTML = current;

    rerender(<RichTextEditor value="ab" onChange={onChange} />);

    expect(setCalls).toBe(0);
  });

  it('positions the placeholder centered within the editable area', () => {
    render(<RichTextEditor value="" onChange={() => {}} placeholder="请输入富文本内容..." />);
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
    const ph = screen.getByText('请输入富文本内容...');
    expect(editor.parentElement).toBe(ph.parentElement);
    expect(editor.parentElement?.className).toContain('relative');
    expect(ph.className).toContain('inset-0');
    expect(ph.className).toContain('justify-center');
  });
});
