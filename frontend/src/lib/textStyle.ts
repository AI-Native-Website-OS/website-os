import type { CSSProperties } from 'react';
import type { TextStyle } from '@/types';

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font_family: '',
  font_size: null,
  color: '',
  font_style: 'normal',
  letter_spacing: null,
};

export const FONT_FAMILY_PRESETS: { key: string; labelKey: string; value: string }[] = [
  { key: 'default', labelKey: 'admin.ui.prompts.fonts.default', value: '' },
  { key: 'system', labelKey: 'admin.ui.prompts.fonts.system', value: '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { key: 'yahei', labelKey: 'admin.ui.prompts.fonts.yahei', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { key: 'simhei', labelKey: 'admin.ui.prompts.fonts.simhei', value: '"SimHei", "Heiti SC", sans-serif' },
  { key: 'simsun', labelKey: 'admin.ui.prompts.fonts.simsun', value: 'SimSun, "Songti SC", serif' },
  { key: 'kaiti', labelKey: 'admin.ui.prompts.fonts.kaiti', value: 'KaiTi, "Kaiti SC", serif' },
  { key: 'inter', labelKey: 'admin.ui.prompts.fonts.inter', value: 'Inter, system-ui, sans-serif' },
  { key: 'roboto', labelKey: 'admin.ui.prompts.fonts.roboto', value: 'Roboto, Arial, sans-serif' },
  { key: 'georgia', labelKey: 'admin.ui.prompts.fonts.georgia', value: 'Georgia, "Times New Roman", serif' },
];

/** CSS custom property used to style the placeholder text color of the chat input. */
export const PLACEHOLDER_COLOR_VAR = '--ph-color';

export function normalizeTextStyle(style?: Partial<TextStyle> | null): TextStyle {
  return { ...DEFAULT_TEXT_STYLE, ...(style || {}) };
}

/**
 * Build inline CSS from a configured text style. Unset values are omitted so
 * existing default (Tailwind) styling is preserved when nothing is configured.
 */
export function textStyleToCss(style?: Partial<TextStyle> | null): CSSProperties {
  const s = normalizeTextStyle(style);
  const css: CSSProperties = {};
  if (s.font_family) css.fontFamily = s.font_family;
  if (s.font_size != null) css.fontSize = `${s.font_size}px`;
  if (s.color) css.color = s.color;
  if (s.letter_spacing != null) css.letterSpacing = `${s.letter_spacing}px`;
  if (s.font_style === 'bold' || s.font_style === 'bold-italic') css.fontWeight = 700;
  if (s.font_style === 'italic' || s.font_style === 'bold-italic') css.fontStyle = 'italic';
  return css;
}

/** Inline CSS for the chat input: text style + placeholder color via CSS variable. */
export function inputTextStyleToCss(style?: Partial<TextStyle> | null, placeholderFallback = '#9ca3af'): CSSProperties {
  const s = normalizeTextStyle(style);
  const css = textStyleToCss(s) as Record<string, unknown>;
  css[PLACEHOLDER_COLOR_VAR] = s.color || placeholderFallback;
  return css as CSSProperties;
}
