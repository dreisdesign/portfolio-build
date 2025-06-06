import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../../');

// Server configurations
const servers = [
  {
    name: 'original public_html',
    dir: 'public_html',
    port: 2000
  },
  {
    name: 'built public_html',
    dir: 'build/temp/public_html',
    port: 2001
  },
  {
    name: 'postsforpause.com',
    dir: 'postsforpause.com',
    port: 2002
  }
];

// Start each server
servers.forEach(({ name, dir, port }) => {
  const app = express();
  const serverDir = path.join(BASE_DIR, dir);

  console.log(`Setting up server for ${name} with directory: ${serverDir}`);

  app.use(express.static(serverDir, {
    extensions: ['html'],
    index: ['index.html']
  }));

  // Special handler for favicon and other static files
  app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(serverDir, 'favicon.ico');

    if (fs.existsSync(faviconPath)) {
      return res.sendFile(faviconPath);
    } else {
      return res.status(404).end();
    }
  });

  // Fallback route for clean URLs
  app.get('*', (req, res) => {
    const filePath = path.join(serverDir, req.path);

    // Check if the path exists as a file
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }

    // Check for index.html
    const indexPath = path.join(serverDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    // If we get here, file wasn't found
    res.status(404).send('File not found');
  });

  app.listen(port, () => {
    console.log(`Server for ${name} running at http://localhost:${port}`);
  });
});
