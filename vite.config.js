import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// 仅开发时使用：页面可以把调试截图 POST 到 /__shot，保存到 .shots 目录
const shots = () => ({
  name: 'debug-shots',
  configureServer(server) {
    const dir = process.env.SHOT_DIR || '.shots';
    if (!dir) return;
    server.middlewares.use('/__shot', (req, res) => {
      const name = path.basename(new URL(req.url, 'http://x').searchParams.get('name') || 'shot.png');
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks)); res.end('ok'); });
    });
  },
});

export default defineConfig({ base: './', server: { port: 5441 }, plugins: [shots()] });
