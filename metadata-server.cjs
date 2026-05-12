const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');

const app = express();
const PORT = process.env.METADATA_PORT || 3002;

// Metadata API endpoint
app.get('/metadata/:key', async (req, res) => {
  try {
    const { key } = req.params;
    console.log('🔍 Metadata request for key:', key);
    
    // Fetch metadata from the main API
    const metadataResponse = await axios.get(`http://p2p-metadata-api:3001/api/metadata/${key}`);
    const metadata = metadataResponse.data;
    
    console.log('📄 Retrieved metadata:', metadata);
    
    // Generate HTML with dynamic meta tags
    const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${metadata.fileName} - P2P File Share</title>
    <meta name="description" content="A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with end-to-end encryption. True peer-to-peer transfer, no server storage." />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://p2p.red/#${key}" />
    <meta property="og:title" content="${metadata.fileName} - Shared via P2P" />
    <meta property="og:description" content="A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with P2P encryption. Download directly from sender." />
    <meta property="og:site_name" content="p2p.red" />
    <meta property="og:image" content="https://p2p.red/favicon.svg" />
    <meta property="og:image:width" content="256" />
    <meta property="og:image:height" content="256" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://p2p.red/#${key}" />
    <meta name="twitter:title" content="${metadata.fileName} - Shared via P2P" />
    <meta name="twitter:description" content="A ${metadata.fileType} file (${formatFileSize(metadata.fileSize)}) shared securely with P2P encryption." />
    <meta name="twitter:image" content="https://p2p.red/favicon.svg" />
    
    <!-- Redirect to main app after 1 second -->
    <meta http-equiv="refresh" content="1; url=https://p2p.red/#${key}" />
    
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        margin: 0;
        padding: 20px;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }
      .container {
        text-align: center;
        max-width: 600px;
        background: rgba(255, 255, 255, 0.1);
        padding: 40px;
        border-radius: 20px;
        backdrop-filter: blur(10px);
      }
      .icon {
        font-size: 4rem;
        margin-bottom: 20px;
      }
      h1 {
        margin: 0 0 10px 0;
        font-size: 2rem;
      }
      .file-info {
        font-size: 1.2rem;
        opacity: 0.9;
        margin: 10px 0;
      }
      .redirect {
        margin-top: 30px;
        font-size: 0.9rem;
        opacity: 0.7;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon">📁</div>
      <h1>${metadata.fileName}</h1>
      <div class="file-info">
        ${metadata.fileType} file • ${formatFileSize(metadata.fileSize)}
      </div>
      <div class="file-info">
        Shared securely with P2P encryption
      </div>
      <div class="redirect">
        Redirecting to download page...
      </div>
    </div>
    
    <script>
      // Immediate redirect for better UX
      window.location.href = 'https://p2p.red/#${key}';
    </script>
  </body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('❌ Metadata error:', error.message);
    
    // Fallback to redirect if metadata not found
    const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="refresh" content="0; url=https://p2p.red/#${req.params.key}" />
  </head>
  <body>
    <p>Redirecting to P2P File Share...</p>
    <script>
      window.location.href = 'https://p2p.red/#${req.params.key}';
    </script>
  </body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(fallbackHtml);
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

app.listen(PORT, () => {
  console.log(`🏷️ Metadata server running on port ${PORT}`);
});
