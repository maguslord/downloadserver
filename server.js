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
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Video URL is required' });
  }

  try {
    // Validate URL
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(videoUrl)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Download video
    const tempInputFile = generateTempFileName();
    const tempOutputFile = generateTempFileName();

    try {
      // Download video
      const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream'
      });

      // Save to temporary file
      const writer = fs.createWriteStream(tempInputFile);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Decrypt/process video using FFmpeg (example decryption)
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', tempInputFile,
          '-c', 'copy',
          tempOutputFile
        ]);

        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg process exited with code ${code}`));
        });

        ffmpeg.stderr.on('data', (data) => {
          console.error(`FFmpeg stderr: ${data}`);
        });
      });

      // Send file to client
      res.download(tempOutputFile, 'downloaded_video.mp4', async (err) => {
        // Cleanup temporary files
        try {
          await fs.unlink(tempInputFile);
          await fs.unlink(tempOutputFile);
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