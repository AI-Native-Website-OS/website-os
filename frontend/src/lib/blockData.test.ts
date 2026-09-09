import { describe, it, expect } from 'vitest';
import { validateBlockTypeData, BLOCK_TYPES, isSectionDataEmpty } from './blockData';

describe('BLOCK_TYPES - html', () => {
  it('includes an html type option with label', () => {
    const entry = BLOCK_TYPES.find((t) => t.type === 'html');
    expect(entry).toBeTruthy();
    expect(entry?.label).toBe('HTML代码');
  });
});

describe('validateBlockTypeData - html', () => {
  it('accepts non-empty html content', () => {
    const errs = validateBlockTypeData('html', { html: '<div>内容</div>' });
    expect(errs).toEqual({});
  });

  it('rejects empty html content', () => {
    const errs = validateBlockTypeData('html', { html: '' });
    expect(errs.html).toBeTruthy();
  });

  it('rejects html that is empty after stripping tags', () => {
    const errs = validateBlockTypeData('html', { html: '<div></div>' });
    expect(errs.html).toBeTruthy();
  });
});

describe('isSectionDataEmpty - html', () => {
  it('returns true for empty html', () => {
    expect(isSectionDataEmpty({ sectionType: 'html', data: { html: '' } })).toBe(true);
  });

  it('returns true for html empty after stripping tags', () => {
    expect(isSectionDataEmpty({ sectionType: 'html', data: { html: '<div></div>' } })).toBe(true);
  });

  it('returns false for non-empty html', () => {
    expect(isSectionDataEmpty({ sectionType: 'html', data: { html: '<p>内容</p>' } })).toBe(false);
  });
});

describe('validateBlockTypeData - module', () => {
  it('does not require module description (empty is valid)', () => {
    const errs = validateBlockTypeData('module', {
      items: [{ title: '模块A', description: '' }],
    });
    expect(errs).toEqual({});
  });

  it('still requires module title', () => {
    const errs = validateBlockTypeData('module', {
      items: [{ title: '', description: '' }],
    });
    expect(errs.mod_title_0).toBeTruthy();
  });

  it('still enforces 200-char limit on module description', () => {
    const errs = validateBlockTypeData('module', {
      items: [{ title: '模块A', description: 'x'.repeat(201) }],
    });
    expect(errs.mod_desc_0).toContain('200');
  });

  it('legacy single-module path does not require description', () => {
    const errs = validateBlockTypeData('module', {
      title: '标题',
      description: '',
    });
    expect(errs).toEqual({});
  });
});

describe('validateBlockTypeData - image_text', () => {
  it('does not require image description (empty is valid)', () => {
    const errs = validateBlockTypeData('image_text', {
      groups: [{ image: 'a.jpg', description: '' }],
    });
    expect(errs).toEqual({});
  });

  it('still requires image', () => {
    const errs = validateBlockTypeData('image_text', {
      groups: [{ image: '', description: '描述' }],
    });
    expect(errs.img_group_img_0).toBeTruthy();
  });

  it('still enforces 200-char limit on image description', () => {
    const errs = validateBlockTypeData('image_text', {
      groups: [{ image: 'a.jpg', description: 'x'.repeat(201) }],
    });
    expect(errs.img_group_desc_0).toContain('200');
  });
});

describe('validateBlockTypeData - timeline', () => {
  it('does not require content (empty is valid)', () => {
    const errs = validateBlockTypeData('timeline', {
      timeline: [{ date: '2024-01-01', content: '' }],
    });
    expect(errs).toEqual({});
  });

  it('still requires date', () => {
    const errs = validateBlockTypeData('timeline', {
      timeline: [{ date: '', content: '内容' }],
    });
    expect(errs.tl_date_0).toBeTruthy();
  });

  it('still enforces 200-char limit on content', () => {
    const errs = validateBlockTypeData('timeline', {
      timeline: [{ date: '2024-01-01', content: 'x'.repeat(201) }],
    });
    expect(errs.tl_content_0).toContain('200');
  });
});