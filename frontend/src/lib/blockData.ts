import { t } from '@/i18n/translate';

export interface BlockTypeOption {
  type: string;
  label: string;
  desc: string;
}

export const BLOCK_TYPE_TYPES = ['list', 'module', 'image_text', 'timeline', 'rich_text', 'html', 'carousel'] as const;

/** 展示类型选项（label/desc 按当前语言实时解析）。 */
export function blockTypes(): BlockTypeOption[] {
  return BLOCK_TYPE_TYPES.map((type) => ({
    type,
    label: t(`libUi.block.types.${type}.label`),
    desc: t(`libUi.block.types.${type}.desc`),
  }));
}

export function blockTypeLabel(type?: string): string {
  if (!type) return t('libUi.block.defaultType');
  if (!(BLOCK_TYPE_TYPES as readonly string[]).includes(type)) return type;
  return t(`libUi.block.types.${type}.label`);
}

export function blockTypeDesc(type?: string): string {
  if (!type || !(BLOCK_TYPE_TYPES as readonly string[]).includes(type)) return '';
  return t(`libUi.block.types.${type}.desc`);
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
    errs.rows = t('libUi.block.errListRows');
  return errs;
}

function validateModuleData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const items = data.items || [];
  if (items.length === 0 && (data.title || data.description)) {
    if (!data.title?.trim()) errs.moduleTitle = t('libUi.block.errModuleTitle');
    if (data.description?.length > 200) errs.moduleDesc = t('libUi.block.errMaxChars', { n: 200 });
  } else if (items.length === 0) {
    errs.moduleItems = t('libUi.block.errModuleItems');
  } else {
    items.forEach((mod: any, i: number) => {
      if (!mod.title?.trim()) errs[`mod_title_${i}`] = t('libUi.block.errModuleItemTitle', { n: i + 1 });
      if (mod.description?.length > 200) errs[`mod_desc_${i}`] = t('libUi.block.errModuleItemMax', { n: i + 1 });
    });
  }
  return errs;
}

function validateImageTextData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const groups = data.groups || [];
  if (groups.length === 0) errs.imageText = t('libUi.block.errImageText');
  else {
    groups.forEach((g: any, i: number) => {
      if (!g.image) errs[`img_group_img_${i}`] = t('libUi.block.errGroupImage', { n: i + 1 });
      if (g.description?.length > 200) errs[`img_group_desc_${i}`] = t('libUi.block.errGroupMax', { n: i + 1 });
    });
  }
  return errs;
}

function validateTimelineData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const timeline = data.timeline || [];
  if (timeline.length === 0) errs.timeline = t('libUi.block.errTimeline');
  else {
    timeline.forEach((node: any, i: number) => {
      if (!node.date) errs[`tl_date_${i}`] = t('libUi.block.errTimelineDate', { n: i + 1 });
      if (node.content?.length > 200) errs[`tl_content_${i}`] = t('libUi.block.errTimelineMax', { n: i + 1 });
    });
  }
  return errs;
}

function validateRichTextData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const html = data.content || '';
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  if (!stripped) errs.richText = t('libUi.block.errRichText');
  return errs;
}

function validateHtmlData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const html = data.html || '';
  const stripped = html.replace(/<[^>]*>/g, '').trim();
  if (!stripped) errs.html = t('libUi.block.errHtml');
  return errs;
}

function validateCarouselData(data: any): Record<string, string> {
  const errs: Record<string, string> = {};
  const items = data.items || [];
  if (items.length === 0) errs.carousel = t('libUi.block.errCarousel');
  else {
    items.forEach((item: any, i: number) => {
      if (!item.image) errs[`car_img_${i}`] = t('libUi.block.errCarouselImage', { n: i + 1 });
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