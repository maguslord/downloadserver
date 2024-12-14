const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'tmp/' });
const PORT = process.env.PORT || 3000;

// Rate limiter: 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many requests, please try again later.'
});

app.use(bodyParser.json());
app.use(limiter);

// POST /download-video
app.post('/download-video', async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Video URL is required.' });
  }

  try {
    // Validate the URL
    const isValidUrl = (url) => {
      try {
        new URL(url);
        return true;
      } catch (err) {
        return false;
      }
    };

    if (!isValidUrl(videoUrl)) {
      return res.status(400).json({ error: 'Invalid URL.' });
    }

    // Download the video
    let filePath = `tmp/video.mp4`;
    await new Promise((resolve, reject) => {
      exec(`curl -o ${filePath} "${videoUrl}"`, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Decrypt the video if encrypted
    const decryptionKey = process.env.DECRYPTION_KEY;
    if (decryptionKey) {
      const decryptedPath = `tmp/decrypted_video.mp4`;
      await new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${filePath} -decryption_key ${decryptionKey} -c copy ${decryptedPath}`, (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve();
        });
      });

      fs.unlinkSync(filePath); // Remove encrypted file
      filePath = decryptedPath;
    }

    // Stream the video back to the client
    res.download(filePath, 'video.mp4', (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send the file.' });
      }
      fs.unlinkSync(filePath); // Clean up temporary files
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error occurred.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});