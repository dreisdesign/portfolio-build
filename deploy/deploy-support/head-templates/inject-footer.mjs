import fs from 'fs';
import path from 'path';

const BUILD_DIR = path.resolve('build/temp/public_html');
const FOOTER_HTML = `\n    <!-- FOOTER -->\n    <div class="wrapper">\n        <footer class="footer" role="contentinfo">\n            <p>\n                Designed &amp; Developed by <b><a href="/about/">Dan Reis</a></b>\n            </p>\n        </footer>\n    </div>\n`;

function injectFooter(html) {
    // Only inject if the build insert comment is present
    if (html.includes('<!-- BUILD_INSERT id="footer" -->')) {
        return html.replace('<!-- BUILD_INSERT id="footer" -->', `${FOOTER_HTML}`);
    }
    // Otherwise, do not inject anything
    return html;
}

function processFile(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');
    const updated = injectFooter(html);
    if (updated !== html) {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`Injected footer: ${filePath}`);
    }
}

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            processFile(fullPath);
        }
    }
}

walk(BUILD_DIR);
console.log('Footer injection complete.');
