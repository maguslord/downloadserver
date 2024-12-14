const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');

// Advanced Logging Configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'combined.log') 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class VideoDownloaderError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'VideoDownloaderError';
    this.statusCode = statusCode;
  }
}

class VideoDownloadManager {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'video-downloader');
    this.ensureTempDirectory();
  }

  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error });
      throw new VideoDownloaderError('Temp directory creation failed');
    }
  }

  generateTempFilePath(extension = 'mp4') {
    const filename = `${crypto.randomBytes(16).toString('hex')}.${extension}`;
    return path.join(this.tempDir, filename);
  }

  validateUrl(url) {
    // More comprehensive URL validation
    const urlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/|dailymotion\.com\/video\/|instagram\.com\/p\/|twitter\.com\/.*\/status\/|facebook\.com\/.*\/videos\/)[a-zA-Z0-9_-]+/;

    if (!urlRegex.test(url)) {
      throw new VideoDownloaderError('Invalid video URL format', 400);
    }
  }

  async downloadVideo(url) {
    this.validateUrl(url);

    const outputPath = this.generateTempFilePath();

    return new Promise((resolve, reject) => {
      // Updated command to avoid shell-specific syntax
      const ytDlpArgs = [
        '--no-playlist',  // Prevent downloading playlists
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--max-filesize', '1G',  // Increase max file size
        '--abort-on-error',
        '--ignore-errors',  // Continue even if some streams fail
        '--add-header', 'Referer:https://www.youtube.com/',  // Add referrer
        '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        '-o', outputPath,
        url
      ];

      // Only add cookies if file exists
      try {
        const cookiesPath = path.join(__dirname, 'youtube-cookies.txt');
        if (fs.existsSync(cookiesPath)) {
          ytDlpArgs.push('--cookies', cookiesPath);
        }
      } catch (err) {
        logger.warn('Cookies file not found', { error: err });
      }

      const ytDlp = spawn('yt-dlp', ytDlpArgs, { 
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const stdoutChunks = [];
      const stderrChunks = [];

      ytDlp.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
      ytDlp.stderr.on('data', (chunk) => stderrChunks.push(chunk));

      ytDlp.on('close', async (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString();
        const stderr = Buffer.concat(stderrChunks).toString();

        // Check if file was actually created
        let fileExists = false;
        try {
          await fs.access(outputPath);
          fileExists = true;
        } catch {}

        if (code !== 0 || !fileExists) {
          logger.error('Video download failed', { 
            url, 
            exitCode: code, 
            stderr,
            stdoutChunks: stdout
          });

          try {
            await fs.unlink(outputPath).catch(() => {});
          } catch {}

          reject(new VideoDownloaderError(`Download failed: ${stderr || 'Unknown error'}`, 500));
          return;
        }

        resolve({
          path: outputPath,
          stdout,
          stderr
        });
      });

      ytDlp.on('error', (err) => {
        logger.error('Spawn error', { error: err });
        reject(new VideoDownloaderError(`Failed to spawn download process: ${err.message}`, 500));
      });
    });
  }
}

class Server {
  constructor() {
    this.app = express();
    this.videoDownloader = new VideoDownloadManager();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS Configuration
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:8080', '*'],  // Added wildcard for testing
      methods: ['POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body Parsing
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Rate Limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 100,  // Limit each IP to 100 requests per window
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', { ip: req.ip });
        res.status(429).json({
          error: 'Too many requests, please try again later',
          retryAfter: Math.ceil(15 * 60 / 100)
        });
      }
    });
    this.app.use(limiter);
  }

  setupRoutes() {
    this.app.post('/download-video', this.handleVideoDownload.bind(this));

    // Global Error Handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error', { 
        error: err, 
        path: req.path, 
        method: req.method 
      });

      res.status(err.statusCode || 500).json({
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
      });
    });
  }

  async handleVideoDownload(req, res, next) {
    try {
      const { videoUrl } = req.body;

      if (!videoUrl) {
        throw new VideoDownloaderError('Video URL is required', 400);
      }

      const downloadResult = await this.videoDownloader.downloadVideo(videoUrl);

      // Stream file to client
      res.download(downloadResult.path, 'downloaded_video.mp4', async (err) => {
        try {
          await fs.unlink(downloadResult.path);
        } catch (cleanupErr) {
          logger.warn('Failed to delete temp file', { error: cleanupErr });
        }

        if (err) {
          logger.error('File download failed', { error: err });
        }
      });

    } catch (error) {
      next(error);
    }
  }

  start(port = 3000) {
    try {
      this.app.listen(port, () => {
        logger.info(`Server running on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }
}

// Initialize and start server
const server = new Server();
server.start();