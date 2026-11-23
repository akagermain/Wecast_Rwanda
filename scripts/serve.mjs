import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(
    fileURLToPath(new URL("../public/", import.meta.url)),
);
const port = Number(process.env.PORT ?? 4173);
const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
};
const security = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

const server = http.createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET, HEAD", ...security });
        return res.end();
    }
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/health") {
        res.writeHead(200, {
            "Content-Type": "text/plain",
            "Cache-control": "no-store",
            "X-Served-By": "Local",
            ...security,
        });
        return res.end(req.method === "HEAD" ? undefined : "WeCast Local OK\n");
    }
    try {
        const relative = decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
        );
        const filename = path.resolve(root, `.${relative}`);
        if (!filename.startsWith(root + path.sep) || !types[path.extname(filename)])
            throw new Error("Not found");
        const data = await readFile(filename);
        res.writeHead(200, {
            "Content-Type": types[path.extname(filename)],
            "Cache-Control": "no-cache",
            "X-Served-By": "Local",
            ...security,
        });
        res.end(req.method === "HEAD" ? undefined : data);
    }   catch {
        res.writeHead(404, security);
        res.end("Not found");
    }
});

server.listen(port, "127.0.0.1", () =>
    console.log(`WeCast Rwanda: http://127.0.0.1:${port}`),
);