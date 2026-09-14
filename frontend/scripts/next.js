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
let host = 'localhost';
const env = { ...process.env };
if (envPath) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) { continue; }
    const i = s.indexOf('=');
    if (i <= 0) { continue; }
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (k === 'FRONTEND_PORT') { port = v; }
    else if (k === 'FRONTEND_HOST') { host = v; }
    else { env[k] = v; }
  }
}

// 使用固定的绝对路径调用可执行文件，避免经 PATH 解析到可被篡改的命令（S4036）
const node = process.execPath;
const nextBin = require.resolve('next/dist/bin/next');

function run(args) {
  const r = spawnSync(node, args, { stdio: 'inherit', env });
  process.exit(r.status);
}

function resolveNpxCli() {
  const nodeDir = path.dirname(node);
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('未找到 npx-cli.js，请确认 Node/npm 安装完整');
}

if (cmd === 'build') {
  run([nextBin, 'build']);
} else if (cmd === 'start') {
  // 生产环境用 serve 托管静态文件（output: 'export' 生成 dist/）
  run([resolveNpxCli(), 'serve', 'dist', '-c', 'serve.json', '-p', port, '--no-clipboard']);
} else {
  run([nextBin, cmd, '-H', host, '-p', port]);
}
