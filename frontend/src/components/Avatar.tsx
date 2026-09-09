'use client';

interface AvatarProps {
  username: string;
  avatar?: string;
  size?: number;
  className?: string;
}

function getInitial(name: string): string {
  if (!name) return '?';
  const char = name.charAt(0);
  if (/[\u4e00-\u9fff]/.test(char)) {
    return char;
  }
  return char.toUpperCase();
}

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export default function Avatar({ username, avatar, size = 36, className = '' }: AvatarProps) {
  const style = { width: size, height: size, minWidth: size, lineHeight: `${size}px` };

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={username}
        className={`rounded-full object-cover ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-medium select-none ${className}`}
      style={{ ...style, fontSize: size * 0.45, backgroundColor: getColorFromName(username) }}
    >
      {getInitial(username)}
    </div>
  );
}
