import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';

const app = express();
const siteDir = process.argv[2];

if (!siteDir) {
  console.error('Please specify a site directory');
  process.exit(1);
}

const resolvedSiteDir = path.resolve(siteDir);
console.log(`Resolved site directory: ${resolvedSiteDir}`);

// Serve static files
app.use(express.static(resolvedSiteDir, {
  extensions: ['html'],
  index: ['index.html']
}));

// Handle favicons and other files properly
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(resolvedSiteDir, 'favicon.ico');

  if (fs.existsSync(faviconPath)) {
    return res.sendFile(faviconPath);
  } else {
    return res.status(404).end();
  }
});

// Fallback route for clean URLs
app.get('*', (req, res) => {
  const filePath = path.join(resolvedSiteDir, req.path);

  // Check if the path exists as a file
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
  } catch (err) {
    console.error(`Error checking file ${filePath}:`, err);
  }

  // Default to index.html for clean URLs
  res.sendFile(path.join(resolvedSiteDir, 'index.html'));
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Serving files from: ${resolvedSiteDir}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
