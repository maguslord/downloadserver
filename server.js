const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again later.'
});
app.use('/download-video', limiter);

// Utility function to generate a unique temporary filename
function generateTempFileName(extension = '.mp4') {
  return path.join(
    process.cwd(), 
    'temp', 
    `${crypto.randomBytes(16).toString('hex')}${extension}`
  );
}

// Video download and decryption endpoint
app.post('/download-video', async (req, res) => {
  console.log('Received request body:', req.body);

  // Extract videoUrl from either JSON or form body
  const videoUrl = req.body.videoUrl || req.body.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Video URL is required' });
  }

  try {
    // More flexible URL validation
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+\.[a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(videoUrl)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const tempInputFile = generateTempFileName();
    const tempOutputFile = generateTempFileName();

    try {
      // Use yt-dlp for universal video downloading
      await new Promise((resolve, reject) => {
        const ytDlp = spawn('yt-dlp', [
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '-o', tempInputFile,
          videoUrl
        ], { 
          shell: true,
          stdio: 'pipe'
        });

        ytDlp.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Video download failed with code ${code}`));
        });

        // Log output for debugging
        ytDlp.stdout.on('data', (data) => {
          console.log(`yt-dlp stdout: ${data}`);
        });

        ytDlp.stderr.on('data', (data) => {
          console.error(`yt-dlp stderr: ${data}`);
        });
      });

      // Send file to client
      res.download(tempInputFile, 'downloaded_video.mp4', async (err) => {
        // Cleanup temporary files
        try {
          await fs.unlink(tempInputFile);
        } catch (cleanupErr) {
          console.error('Error cleaning up temp files:', cleanupErr);
        }

        if (err) {
          console.error('Download error:', err);
        }
      });

    } catch (downloadError) {
      console.error('Download failed:', downloadError);
      res.status(500).json({ 
        error: 'Failed to download video', 
        details: downloadError.message 
      });
    }

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Ensure temp directory exists
const tempDir = path.join(process.cwd(), 'temp');
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

module.exports = app;