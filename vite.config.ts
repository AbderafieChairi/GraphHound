import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import fs from "node:fs";
import path from "node:path";

export default defineConfig(({ command }) => ({
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      server: { entry: "src/server.ts" },
    }),
    react(),
    tailwindcss(),
    {
      name: "copy-sqlite-shim",
      closeBundle() {
        const src = path.resolve("src/vendor/sqlite-shim.cjs");
        const dest = path.resolve("dist/server/vendor/sqlite-shim.cjs");
        
        // 1. Copy sqlite-shim.cjs
        if (fs.existsSync(src)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
          console.log("Successfully copied sqlite-shim.cjs to server build output.");
        }

        // Bundled leangraph runs `require("../package.json").version` from
        // dist/server/assets/, so give it a package.json to find. Without this
        // the import throws and the first DB call (e.g. reset on upload) never settles.
        fs.writeFileSync(
          path.resolve("dist/server/package.json"),
          JSON.stringify(
            { type: "module", version: process.env.npm_package_version ?? "1.0.0" },
            null,
            2,
          ),
          "utf8",
        );

        // 2. Generate standalone dist/server.js
        const runnerContent = `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeRequest, sendNodeResponse } from 'srvx/node';
import serverBuild from './server/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, 'client');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  try {
    let rawUrl = req.url.split('?')[0];
    if (rawUrl === '/') {
      rawUrl = '/index.html';
    }

    let filePath = path.join(CLIENT_DIR, rawUrl);
    
    if (!filePath.startsWith(CLIENT_DIR)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    } catch {
      // File not found, proceed to SSR
    }

    const webReq = new NodeRequest({ req, res });
    const webRes = await serverBuild.fetch(webReq);

    res.setHeaders(webRes.headers);
    res.writeHead(webRes.status, webRes.statusText);
    await sendNodeResponse(res, webRes);
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(\`Server is running at http://localhost:\${PORT}\`);
});
`;
        fs.writeFileSync(path.resolve("dist/server.js"), runnerContent, "utf8");
        console.log("Successfully generated dist/server.js.");

        // 3. Generate standalone dist/package.json
        const packageJsonContent = JSON.stringify({
          name: "graphhound-standalone",
          version: process.env.npm_package_version ?? "1.0.0",
          type: "module",
          main: "server.js",
          scripts: {
            "start": "node server.js"
          },
          dependencies: {
            "srvx": "^0.11.9"
          }
        }, null, 2);
        fs.writeFileSync(path.resolve("dist/package.json"), packageJsonContent, "utf8");
        console.log("Successfully generated dist/package.json.");
      }
    }
  ],
  optimizeDeps: {
    force: true,
  },
  // Bundle every server dependency into dist/server so the build is
  // self-contained and does not need the repo's node_modules at runtime.
  // Build only: in dev, inlining CJS packages (e.g. react) breaks SSR.
  ...(command === "build" ? { ssr: { noExternal: true } } : {}),
}));
