const express = require('express');
const { spawn } = require('child_process');
const cookieParser = require('cookie-parser');
const app = express();

app.use(express.json());
app.use(cookieParser());  // For parsing cookies from the request

// Endpoint to fetch available formats
app.post('/formats', (req, res) => {
  const url = req.body.url;
  const cookies = req.headers.cookie;  // Get cookies from request headers

  console.log(`Fetching formats for URL: ${url}, Cookies: ${cookies}`);

  const process = spawn('yt-dlp', [
    url,
    '--dump-json',  // Get JSON output of available formats
    '--no-warnings',
    '--cookie', cookies,  // Pass cookies to yt-dlp
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  ]);

  let formatsData = '';
  let errorData = '';

  process.stdout.on('data', (data) => {
    formatsData += data.toString();
  });

  process.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  process.on('close', (code) => {
    if (code === 0) {
      try {
        const formats = JSON.parse(formatsData);
        if (formats.formats && formats.formats.length > 0) {
          const availableFormats = formats.formats.map(format => ({
            format_id: format.format_id,
            ext: format.ext,
            resolution: format.resolution || `${format.width}x${format.height}`,
            fps: format.fps || 'N/A',
            filesize: format.filesize || 'N/A',
            format: format.format,
          }));
          res.json({ formats: availableFormats });
        } else {
          res.status(404).json({ error: 'No formats found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to parse formats', details: error.message });
      }
    } else {
      res.status(500).json({ error: 'Failed to fetch video formats', details: errorData });
    }
  });
});

// Endpoint to download the video
app.post('/download', (req, res) => {
  const { url, format } = req.body;
  const cookies = req.headers.cookie;  // Get cookies from the request header

  console.log(`Starting download: URL ${url}, Format ${format}, Cookies: ${cookies}`);

  // Setting headers for the file download
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="downloaded_video.mp4"'); // Suggested filename

  const process = spawn('yt-dlp', [
    url,
    '-f', format,  // Use the selected format
    '-o', '-',     // Output to stdout
    '--no-warnings',
    '--cookie', cookies,  // Pass cookies
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  ]);

  process.stdout.pipe(res);

  process.stderr.on('data', (data) => {
    console.error(`Download error: ${data.toString()}`);
  });

  process.on('close', (code) => {
    if (code !== 0) {
      console.error(`Download failed with code ${code}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed', code: code });
      }
    }
    res.end();
  });

  req.on('close', () => {
    process.kill();
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
