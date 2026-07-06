#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = process.cwd();
const port = Number(process.argv[2] || process.env.PORT || 4173);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded)
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]+/, '');
  return path.join(root, normalized);
}

function hasExtension(urlPath) {
  return path.basename(urlPath).includes('.');
}

function findStaticFile(urlPath) {
  const requested = safePath(urlPath);
  const candidates = urlPath.endsWith('/')
    ? [path.join(requested, 'index.html')]
    : [requested, path.join(requested, 'index.html')];

  return candidates.find((filePath) => {
    try {
      return fs.statSync(filePath).isFile();
    } catch (_) {
      return false;
    }
  });
}

function fallbackResponse(method, urlPath) {
  const canUseAppShell = (method === 'GET' || method === 'HEAD') && !hasExtension(urlPath);
  return {
    filePath: canUseAppShell ? path.join(root, 'index.html') : path.join(root, '404.html'),
    status: canUseAppShell ? 200 : 404
  };
}

function serveFile(response, filePath, method, status) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(method === 'HEAD' ? undefined : 'Not found');
      return;
    }

    response.writeHead(status, {
      'content-type': contentType,
      'content-length': data.byteLength
    });
    response.end(method === 'HEAD' ? undefined : data);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const staticFile = findStaticFile(url.pathname);
  const fallback = staticFile
    ? { filePath: staticFile, status: 200 }
    : fallbackResponse(request.method.toUpperCase(), url.pathname);

  serveFile(response, fallback.filePath, request.method.toUpperCase(), fallback.status);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Frontier of Jefferson preview: http://127.0.0.1:${port}/`);
});
