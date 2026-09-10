export interface BlockTypeOption {
  type: string;
  label: string;
  desc: string;
}

export const BLOCK_TYPES: BlockTypeOption[] = [
  { type: 'list', label: '列表', desc: '新闻列表、产品列表、文章列表等' },
  { type: 'module', label: '模块', desc: '服务介绍、功能展示等' },
  { type: 'image_text', label: '图文', desc: '产品展示、案例展示等' },
  { type: 'timeline', label: '时间线', desc: '发展历程、大事记等' },
  { type: 'rich_text', label: '富文本', desc: '公司简介、详细说明等' },
  { type: 'html', label: 'HTML代码', desc: '粘贴 HTML 源码，前台原样渲染' },
  { type: 'carousel', label: '轮播图', desc: 'Banner、广告位等' },
];

export const BLOCK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BLOCK_TYPES.map((t) => [t.type, t.label])
);

export function blockTypeLabel(type?: string): string {
  if (!type) return '富文本';
  return BLOCK_TYPE_LABELS[type] || type;
}

/**
 * 解析区块/内容项的 extraData JSON。
 * 兼容两层结构：{ "data": {...} } 或 { "sectionType": "list", "data": {...} }
 */
export function parseBlockExtraData(extraData?: string): { sectionType?: string; data: any } {
  if (!extraData) return { sectionType: undefined, data: {} };
  try {
    const parsed = JSON.parse(extraData);
    return {
      sectionType: typeof parsed === 'object' && parsed !== null ? parsed.sectionType : undefined,
      data: typeof parsed === 'object' && parsed !== null ? (parsed.data || parsed) : {},
    };
  } catch {
    return { sectionType: undefined, data: {} };
  }
}

/** 序列化区块数据（带可选展示类型）。与 BlockForm 的 { data } 结构保持一致。 */
export function serializeBlockData(data: any, sectionType?: string): string {
  if (sectionType) {
    return JSON.stringify({ sectionType, data });
  }
  return JSON.stringify({ data });
}

export interface SectionEntry {
  sectionType: string;
  data: any;
}

/**
 * 解析内容项 extraData 中的展示组列表。
 * 兼容三种形态：{ sections: [...] } 多组、{ sectionType, data } 单组、其它/空返回 []。
 */
export function parseContentSections(extraData?: string | null): SectionEntry[] {
  if (!extraData || !extraData.trim()) return [];
  try {
    const parsed = JSON.parse(extraData);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sections)) {
      return parsed.sections.filter((s: any) => s && typeof s === 'object');
    }
    if (parsed && typeof parsed === 'object' && parsed.sectionType) {
      return [{ sectionType: parsed.sectionType, data: parsed.data || {} }];
    }
    return [];
  } catch {
    return [];
  }
}

/** 判断一个展示组是否未填写任何数据（用于「组可为空」场景） */
export function isSectionDataEmpty(section: SectionEntry): boolean {
  const d = section.data || {};
  switch (section.sectionType) {
    case 'rich_text': {
      const html = d.content || '';
      return !html.replace(/<[^>]*>/g, '').trim();
    }
    case 'html': {
      const html = d.html || '';
      return !html.replace(/<[^>]*>/g, '').trim();
    }
    case 'list': {
      const rows = d.rows || [];
      const cols = (d.columns && d.columns.length > 0) ? d.columns : ['key', 'value'];
      return rows.every((r: any) => cols.every((c: string) => !r?.[c]?.trim()));
    }
    case 'module': {
      const items = d.items || [];
      if (items.length === 0) return !(d.title?.trim() || d.description?.trim());
      return items.every((it: any) => !it?.title?.trim() && !it?.description?.trim());
    }
    case 'image_text': {
      const groups = d.groups || [];
      return groups.every((g: any) => !g?.image && !g?.description?.trim());
    }
    case 'timeline': {
      const timeline = d.timeline || [];
      return timeline.every((n: any) => !n?.date && !n?.content?.trim());
    }
    case 'carousel': {
      const items = d.items || [];
      return items.every((it: any) => !it?.image);
    }
    default:
      return false;
  }
}

/** 从数据库记录中安全读取展示类型（多组取首组，无则为富文本） */
export function getRecordSectionType(record?: { extraData?: string } | null): string {
  if (!record) return 'rich_text';
  const sections = parseContentSections(record.extraData);
  return sections[0]?.sectionType || 'rich_text';
}

function validateListData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const rows = data.rows || [];
  const cols = (data.columns && data.columns.length > 0) ? data.columns : ['key', 'value'];
  if (rows.length === 0 || rows.every((r: any) => cols.every((c: string) => !r[c]?.trim())))
    errs.rows = '至少需要一条有效数据行';
  return errs;
}

function validateModuleData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const items = data.items || [];
  if (items.length === 0 && (data.title || data.description)) {
    if (!data.title?.trim()) errs.moduleTitle = '模块标题不能为空';
    if (data.description?.length > 200) errs.moduleDesc = '最多200个字符';
  } else if (items.length === 0) {
    errs.moduleItems = '至少需要一个模块';
  } else {
    items.forEach((mod: any, i: number) => {
      if (!mod.title?.trim()) errs[`mod_title_${i}`] = `模块${i + 1}标题不能为空`;
      if (mod.description?.length > 200) errs[`mod_desc_${i}`] = `模块${i + 1}最多200个字符`;
    });
  }
  return errs;
}

function validateImageTextData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const groups = data.groups || [];
  if (groups.length === 0) errs.imageText = '至少需要一组图文';
  else {
    groups.forEach((g: any, i: number) => {
      if (!g.image) errs[`img_group_img_${i}`] = `第${i + 1}组图片不能为空`;
      if (g.description?.length > 200) errs[`img_group_desc_${i}`] = `第${i + 1}组最多200个字符`;
    });
  }
  return errs;
}

function validateTimelineData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const timeline = data.timeline || [];
  if (timeline.length === 0) errs.timeline = '至少需要一个时间节点';
  else {
    timeline.forEach((node: any, i: number) => {
      if (!node.date) errs[`tl_date_${i}`] = `第${i + 1}行日期不能为空`;
      if (node.content?.length > 200) errs[`tl_content_${i}`] = `第${i + 1}行最多200个字符`;
    });
  }
  return errs;
}

function validateRichTextData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const html = data.content || '';
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  if (!stripped) errs.richText = '富文本内容不能为空';
  return errs;
}

function validateHtmlData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const html = data.html || '';
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  if (!stripped) errs.html = 'HTML 代码不能为空';
  return errs;
}

function validateCarouselData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const items = data.items || [];
  if (items.length === 0) errs.carousel = '至少需要一个轮播项';
  else {
    items.forEach((item: any, i: number) => {
      if (!item.image) errs[`car_img_${i}`] = `第${i + 1}项图片不能为空`;
    });
  }
  return errs;
}

const BLOCK_DATA_VALIDATORS: Record<string, (data: any) => Record<string, string>> = {
  list: validateListData,
  module: validateModuleData,
  image_text: validateImageTextData,
  timeline: validateTimelineData,
  rich_text: validateRichTextData,
  html: validateHtmlData,
  carousel: validateCarouselData,
};

/** 按展示类型校验 data 字段，返回错误映射（不含标题/副标题等通用字段校验） */
export function validateBlockTypeData(type: string, data: any): Record<string, string> {
  const validator = BLOCK_DATA_VALIDATORS[type];
  return validator ? validator(data) : {};
}