const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const app = express();
const port = 3000;

// Configure Winston logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'video-downloader' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

app.use(cors());
app.use(express.json());

// Middleware to validate input
const validateInput = (req, res, next) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'URL is required',
      details: 'Please provide a valid video URL'
    });
  }

  next();
};

// Ensure downloads directory exists
const ensureDownloadsDir = () => {
  const downloadsPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
};

// Endpoint to get available formats
app.post('/formats', validateInput, (req, res) => {
    const url = req.body.url;
    
    logger.info(`Fetching formats for URL: ${url}`);
    
    // Updated yt-dlp command with alternative authentication bypass methods
    const process = spawn('yt-dlp', [
        url, 
        '--list-formats', 
        '--dump-json',
        '--no-warnings',
        '--age-limit', '99',
        '--ignore-config',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        // Additional parameters to bypass restrictions
        '--extractor-retries', '3',
        '--fragment-retries', '3',
        '--no-part',
        '--no-mtime'
    ]);
    
    let formatsData = '';
    let errorData = '';
    
    process.stdout.on('data', (data) => {
        formatsData += data.toString();
    });
    
    process.stderr.on('data', (data) => {
        errorData += data.toString();
        logger.error(`Format fetch error: ${errorData}`);
    });
    
    process.on('close', (code) => {
        if (code === 0) {
            try {
                // Parse the formats from the JSON output
                const formats = formatsData.trim().split('\n')
                    .map(line => {
                        try {
                            return JSON.parse(line);
                        } catch(parseError) {
                            logger.warn(`Could not parse format line: ${line}`);
                            return null;
                        }
                    })
                    .filter(format => format !== null)
                    .map(format => ({
                        format_id: format.format_id,
                        ext: format.ext,
                        resolution: format.resolution || `${format.width}x${format.height}`,
                        fps: format.fps || 'N/A',
                        filesize: format.filesize || 'N/A',
                        format: format.format
                    }));
                
                if (formats.length === 0) {
                    return res.status(404).json({ 
                        error: 'No formats found',
                        details: 'Unable to extract video formats'
                    });
                }
                
                res.json({ formats });
            } catch (error) {
                logger.error(`Format parsing error: ${error}`);
                res.status(500).json({ 
                    error: 'Failed to parse formats',
                    details: error.message 
                });
            }
        } else {
            logger.error(`Format fetch failed with code ${code}: ${errorData}`);
            res.status(500).json({ 
                error: 'Failed to fetch video formats',
                details: errorData 
            });
        }
    });
});

// Endpoint to download the video
app.post('/download', validateInput, (req, res) => {
    const { url, format } = req.body;
    
    // Validate format
    if (!format) {
        return res.status(400).json({ 
            error: 'Format is required',
            details: 'Please select a video format'
        });
    }
    
    logger.info(`Starting download: URL ${url}, Format ${format}`);
    
    // Ensure downloads directory exists
    ensureDownloadsDir();
    
    const outputPath = path.join(__dirname, 'downloads', '%(title)s.%(ext)s');
    const process = spawn('yt-dlp', [
        url, 
        '-f', format, 
        '-o', outputPath,
        '--no-warnings',
        '--age-limit', '99',
        '--ignore-config',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        // Additional parameters to improve download reliability
        '--extractor-retries', '3',
        '--fragment-retries', '3',
        '--no-part',
        '--no-mtime'
    ]);
    
    let outputData = '';
    let errorData = '';
    
    process.stdout.on('data', (data) => {
        outputData += data.toString();
        logger.info(`Download output: ${data.toString()}`);
    });
    
    process.stderr.on('data', (data) => {
        errorData += data.toString();
        logger.error(`Download error: ${data.toString()}`);
    });
    
    process.on('close', (code) => {
        if (code === 0) {
            logger.info(`Download successful for URL: ${url}`);
            res.json({ 
                message: 'Download started successfully', 
                output: outputData 
            });
        } else {
            logger.error(`Download failed with code ${code}: ${errorData}`);
            res.status(500).json({ 
                error: 'Download failed',
                details: errorData,
                code: code 
            });
        }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({
        error: 'Internal Server Error',
        details: err.message
    });
});

app.listen(port, '0.0.0.0', () => {
    logger.info(`Server is running at http://0.0.0.0:${port}`);
    console.log(`Server is running at http://0.0.0.0:${port}`);
});