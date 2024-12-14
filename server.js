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
app.use(express.json()); // Important: parse JSON bodies

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
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
  console.log('Received request body:', req.body); // Debug logging

  const { videoUrl } = req.body;

  if (!videoUrl) {
    console.log('No video URL provided'); // Debug logging
    return res.status(400).json({ error: 'Video URL is required' });
  }

  try {
    // More flexible URL validation
    const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    if (!urlPattern.test(videoUrl)) {
      console.log('Invalid URL format:', videoUrl); // Debug logging
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Download video using youtube-dl or similar tool
    const tempInputFile = generateTempFileName();
    const tempOutputFile = generateTempFileName();

    try {
      // Using youtube-dl for YouTube video download
      await new Promise((resolve, reject) => {
        const youtubeDl = spawn('youtube-dl', [
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '-o', tempInputFile,
          videoUrl
        ]);

        youtubeDl.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`youtube-dl process exited with code ${code}`));
        });

        youtubeDl.stderr.on('data', (data) => {
          console.error(`youtube-dl stderr: ${data}`);
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