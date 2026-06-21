const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.png': 'image/png',
};

http.createServer((request, response) => {
    const pathname = decodeURIComponent(
        new URL(request.url, 'http://127.0.0.1').pathname
    );
    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.resolve(root, relativePath);

    if (!filePath.startsWith(root)) {
        response.statusCode = 403;
        response.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            response.statusCode = 404;
            response.end('Not found');
            return;
        }
        response.setHeader(
            'Content-Type',
            contentTypes[path.extname(filePath)] || 'application/octet-stream'
        );
        response.end(data);
    });
}).listen(4173, '127.0.0.1', () => {
    console.log('WordBot preview: http://127.0.0.1:4173/?demo=1');
});
