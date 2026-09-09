import { Github, BookOpen, Rocket, Code, Star, Sparkles, GitFork, FileText, Lightbulb, Target, FlaskConical } from 'lucide-react';
import type { ComponentType } from 'react';

export interface OpenIconOption {
  key: string;
  icon: ComponentType<{ className?: string }>;
  hover: string;
  labelKey: string;
}

export function GiteeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296Z" />
    </svg>
  );
}

export const OPEN_ICON_OPTIONS: OpenIconOption[] = [
  { key: 'github', icon: Github, hover: 'hover:text-black', labelKey: 'admin.ui.settings.openIcons.github' },
  { key: 'gitee', icon: GiteeIcon, hover: 'hover:text-[#C71D23]', labelKey: 'admin.ui.settings.openIcons.gitee' },
  { key: 'book', icon: BookOpen, hover: 'hover:text-blue-600', labelKey: 'admin.ui.settings.openIcons.book' },
  { key: 'rocket', icon: Rocket, hover: 'hover:text-orange-500', labelKey: 'admin.ui.settings.openIcons.rocket' },
  { key: 'code', icon: Code, hover: 'hover:text-indigo-500', labelKey: 'admin.ui.settings.openIcons.code' },
  { key: 'star', icon: Star, hover: 'hover:text-amber-500', labelKey: 'admin.ui.settings.openIcons.star' },
  { key: 'sparkles', icon: Sparkles, hover: 'hover:text-violet-500', labelKey: 'admin.ui.settings.openIcons.sparkles' },
  { key: 'gitfork', icon: GitFork, hover: 'hover:text-emerald-600', labelKey: 'admin.ui.settings.openIcons.gitfork' },
  { key: 'file', icon: FileText, hover: 'hover:text-sky-500', labelKey: 'admin.ui.settings.openIcons.file' },
  { key: 'lightbulb', icon: Lightbulb, hover: 'hover:text-yellow-600', labelKey: 'admin.ui.settings.openIcons.lightbulb' },
  { key: 'target', icon: Target, hover: 'hover:text-red-500', labelKey: 'admin.ui.settings.openIcons.target' },
  { key: 'flask', icon: FlaskConical, hover: 'hover:text-teal-600', labelKey: 'admin.ui.settings.openIcons.flask' },
];

export const OPEN_ICON_MAP: Record<string, OpenIconOption> = Object.fromEntries(
  OPEN_ICON_OPTIONS.map((o) => [o.key, o])
);

export function resolveOpenIcon(key?: string): OpenIconOption {
  return (key && OPEN_ICON_MAP[key]) || OPEN_ICON_OPTIONS[0];
}