// 実機 lighttpd の gzip-only 配信規則を模擬する静的サーバ。
// CSS/JS の 404(過去に実機で発生した真っ白画面)を E2E で恒常検知するのが目的。
//
// 模擬する規則(overlay_rootfs/etc/lighttpd/lighttpd.conf + local_build.sh):
// - index.html は .css 参照を .css.gz に sed 置換したものを配信
// - *.js 要求は *.js.gz を Content-Encoding: gzip で配信(非圧縮 .js は実機に存在しない)
// - *.css 要求は rewrite で *.css.gz(無ければ非圧縮 .css)
// - *.gz 直接要求は mimetype.assign 相当の Content-Type + Content-Encoding: gzip
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// local_build.sh の sed 相当
const indexHtml = readFileSync(path.join(dist, 'index.html'), 'utf8')
  .replace(/\.css"/g, '.css.gz"')
  .replace(/\.css'/g, ".css.gz'");

function send(res, status, headers, streamPath) {
  res.writeHead(status, headers);
  if (streamPath) createReadStream(streamPath).pipe(res);
  else res.end();
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(indexHtml);
    return;
  }

  const file = path.join(dist, pathname);
  if (!file.startsWith(dist)) return send(res, 403, {});
  const ext = path.extname(pathname);

  if (ext === '.gz') {
    const inner = path.extname(pathname.slice(0, -3));
    if (existsSync(file)) {
      return send(res, 200, { 'Content-Type': MIME[inner] ?? 'application/octet-stream', 'Content-Encoding': 'gzip' }, file);
    }
    return send(res, 404, {});
  }

  if (ext === '.js') {
    // 実機では非圧縮 .js は削除済み — .gz が無ければ 404(これが検知対象)
    const gz = `${file}.gz`;
    if (existsSync(gz)) return send(res, 200, { 'Content-Type': MIME['.js'], 'Content-Encoding': 'gzip' }, gz);
    return send(res, 404, {});
  }

  if (ext === '.css') {
    const gz = `${file}.gz`;
    if (existsSync(gz)) return send(res, 200, { 'Content-Type': MIME['.css'], 'Content-Encoding': 'gzip' }, gz);
    if (existsSync(file)) return send(res, 200, { 'Content-Type': MIME['.css'] }, file);
    return send(res, 404, {});
  }

  if (existsSync(file)) {
    return send(res, 200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' }, file);
  }
  return send(res, 404, {});
});

server.listen(port, () => {
  console.log(`lighttpd-sim: serving ${dist} on http://127.0.0.1:${port}`);
});
