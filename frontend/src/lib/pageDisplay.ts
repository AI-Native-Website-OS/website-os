export function safeDecode(text: string): string {
  try { return decodeURIComponent(text); } catch { return text; }
}

export function stripTrailingDigits(text: string): string {
  return text.replace(/\d+$/, '');
}

export function urlToDisplayTitle(url: string | null | undefined, homeLabel: string): string {
  if (!url || url === '/') return homeLabel;
  const path = url.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  const last = stripTrailingDigits(safeDecode(parts[parts.length - 1] || ''));
  if (!last) return homeLabel;
  return last.length > 30 ? last.slice(0, 30) + '...' : last;
}
