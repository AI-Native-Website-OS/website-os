import { describe, it, expect } from 'vitest';
import {
  BLOCK_IMAGE_RULES,
  DEFAULT_DOCUMENT_RULES,
  HTML_IMAGE_RULES,
  getFileExtension,
  validateFileName,
  validateFileExtension,
  validateFileSize,
  validateDocumentFile,
  validateImageFile,
} from './uploadRules';

describe('uploadRules filename helpers', () => {
  it('extracts extension and base name', () => {
    expect(getFileExtension('a.jpg')).toBe('jpg');
    expect(getFileExtension('a.b.c.PNG')).toBe('png');
    expect(getFileExtension('noext')).toBe('');
  });

  it('rejects name longer than 100 chars', () => {
    const long = 'a'.repeat(101) + '.jpg';
    expect(validateFileName(long, BLOCK_IMAGE_RULES)).toBe('文件名长度不能超过 100 个字符');
    const ok = 'a'.repeat(100) + '.jpg';
    expect(validateFileName(ok, BLOCK_IMAGE_RULES)).toBeNull();
  });

  it('rejects names with special chars', () => {
    expect(validateFileName('a:b.jpg', BLOCK_IMAGE_RULES)).toContain('特殊字符');
    expect(validateFileName('a?b.jpg', BLOCK_IMAGE_RULES)).toContain('特殊字符');
    expect(validateFileName('正常图片.jpg', BLOCK_IMAGE_RULES)).toBeNull();
  });
});

describe('uploadRules image validation', () => {
  it('rejects forbidden and unallowed extensions', () => {
    expect(validateFileExtension('x.svg', BLOCK_IMAGE_RULES)).toContain('不支持 svg');
    expect(validateFileExtension('x.gif', BLOCK_IMAGE_RULES)).toContain('不支持 gif');
    expect(validateFileExtension('x.bmp', BLOCK_IMAGE_RULES)).toContain('不支持 bmp');
    expect(validateFileExtension('x.jpg', BLOCK_IMAGE_RULES)).toBeNull();
    expect(validateFileExtension('x.webp', BLOCK_IMAGE_RULES)).toBeNull();
  });
});

describe('HTML_IMAGE_RULES', () => {
  it('has no exact size requirement (for HTML template embedded images)', () => {
    expect(HTML_IMAGE_RULES.exactSize).toBeUndefined();
    expect(HTML_IMAGE_RULES.maxSizeMB).toBe(BLOCK_IMAGE_RULES.maxSizeMB);
    expect(HTML_IMAGE_RULES.allowedExtensions).toEqual(BLOCK_IMAGE_RULES.allowedExtensions);
  });

  it('validates a normal jpg without a dimension check', async () => {
    const err = await validateImageFile(new File(['x'], 'photo.jpg'), HTML_IMAGE_RULES);
    expect(err).toBeNull();
  });

  it('still rejects forbidden extensions', async () => {
    expect(await validateImageFile(new File(['x'], 'x.svg'), HTML_IMAGE_RULES)).toContain('不支持 svg');
  });
});

describe('uploadRules document validation', () => {
  it('accepts doc/docx/pdf only', () => {
    expect(validateDocumentFile(new File(['x'], 'a.pdf'))).toBeNull();
    expect(validateDocumentFile(new File(['x'], 'a.doc'))).toBeNull();
    expect(validateDocumentFile(new File(['x'], 'a.docx'))).toBeNull();
  });

  it('rejects forbidden extensions', () => {
    expect(validateDocumentFile(new File(['x'], 'a.exe'))).toContain('不支持 exe');
    expect(validateDocumentFile(new File(['x'], 'a.php'))).toContain('不支持 php');
    expect(validateDocumentFile(new File(['x'], 'a.sh'))).toContain('不支持 sh');
  });

  it('rejects unallowed extension', () => {
    expect(validateDocumentFile(new File(['x'], 'a.txt'))).toContain('仅支持');
    expect(validateDocumentFile(new File(['x'], 'a.png'))).toContain('仅支持');
  });

  it('rejects oversize file', () => {
    const big = new File([new Uint8Array(21 * 1024 * 1024)], 'a.pdf');
    expect(validateDocumentFile(big)).toContain('20MB');
  });

  it('accepts size within limit', () => {
    expect(validateFileSize(5 * 1024 * 1024, DEFAULT_DOCUMENT_RULES)).toBeNull();
    expect(validateFileSize(21 * 1024 * 1024, DEFAULT_DOCUMENT_RULES)).toContain('20MB');
  });
});