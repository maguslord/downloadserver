const express = require('express');
const cors = require('cors');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Ensure yt-dlp is installed
try {
  execSync('pip install yt-dlp');
} catch (error) {
  console.error('Failed to install yt-dlp:', error);
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Ensure downloads directory exists
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

// Download endpoint
app.post("/download", (req, res) => {
  const { url, format = 'best' } = req.body;

  // Validate URL
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Generate a unique filename
  const timestamp = Date.now();
  const outputTemplate = path.join(DOWNLOAD_DIR, `%(title)s-${timestamp}.%(ext)s`);

  // Prepare yt-dlp arguments
  const args = [
    url,
    '-f', format, // Select best quality by default
    '-o', outputTemplate,
    '--no-playlist', // Download only specified video
    '--print', 'filename' // Print output filename
  ];

  // Spawn yt-dlp process
  const ytDlp = spawn('yt-dlp', args);

  let outputFilename = '';
  let errorOutput = '';

  // Capture output filename
  ytDlp.stdout.on('data', (data) => {
    outputFilename += data.toString().trim();
  });

  // Capture error output
  ytDlp.stderr.on('data', (data) => {
    errorOutput += data.toString();
    console.error('yt-dlp error:', data.toString());
  });

  // Handle process completion
  ytDlp.on('close', (code) => {
    if (code !== 0) {
      console.error('Download failed:', errorOutput);
      return res.status(500).json({ 
        error: 'Download failed', 
        details: errorOutput 
      });
    }

    // Verify file exists
    if (!fs.existsSync(outputFilename)) {
      return res.status(500).json({ error: 'File not found after download' });
    }

    // Send file
    res.download(outputFilename, path.basename(outputFilename), (err) => {
      if (err) {
        console.error('File send error:', err);
        res.status(500).json({ error: 'Failed to send file' });
      }

      // Optional: Delete file after sending
      try {
        fs.unlinkSync(outputFilename);
      } catch (deleteErr) {
        console.error('Failed to delete file:', deleteErr);
      }
    });
  });

  // Handle spawn errors
  ytDlp.on('error', (err) => {
    console.error('Spawn error:', err);
    res.status(500).json({ 
      error: 'Failed to start download process', 
      details: err.message 
    });
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'Server is running',
    supportedFormats: [
      'best', // Best overall quality
      'bestaudio', // Best audio
      'bestvideo', // Best video
      'mp4', // MP4 format
      'webm', // WebM format
    ]
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Robust YouTube Downloader running at http://${HOST}:${PORT}`);
});