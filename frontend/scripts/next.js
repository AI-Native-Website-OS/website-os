const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cmd = process.argv[2];

// 依次尝试可能的路径：项目根目录 → Docker 路径
const candidates = [
  path.resolve(__dirname, '../../.env'),
  '/app/.env',
];
let envPath = null;
for (const c of candidates) {
  if (fs.existsSync(c)) { envPath = c; break; }
}

let port = '3200';
const env = { ...process.env };
if (envPath) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i <= 0) continue;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (k === 'FRONTEND_PORT') port = v;
    else env[k] = v;
  }
}

if (cmd === 'build') {
  const r = spawnSync('next', ['build'], { stdio: 'inherit', shell: true, env });
  process.exit(r.status);
} else if (cmd === 'start') {
  // 生产环境用 serve 托管静态文件（output: 'export' 生成 dist/）
  const r = spawnSync('npx', ['serve', 'dist', '-c', 'serve.json', '-p', port, '--no-clipboard'], { stdio: 'inherit', shell: true, env });
  process.exit(r.status);
} else {
  spawnSync('next', [cmd, '-p', port], { stdio: 'inherit', shell: true, env });
}
