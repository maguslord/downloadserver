const express = require("express");
const ytdl = require("ytdl-core");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Comprehensive CORS configuration
app.use(cors({
  origin: '*', // Be careful with this in production
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Detailed logging middleware
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

// POST endpoint to download video/audio
app.post("/download", async (req, res) => {
  console.log('Download request received');
  console.log('Request body:', req.body);
  
  const { url } = req.body;

  // Validate the URL
  if (!url || !ytdl.validateURL(url)) {
    console.error('Invalid URL:', url);
    return res.status(400).send("Invalid URL provided.");
  }

  try {
    // Get video info to handle potential extraction issues
    const videoInfo = await ytdl.getInfo(url);

    // Extract video ID from the URL
    const videoId = videoInfo.videoDetails.videoId;

    // Path to save the video/audio file
    const downloadPath = path.join(__dirname, `${videoId}.mp4`);

    // Download the video/audio with more robust options
    const videoStream = ytdl(url, { 
      filter: "audioandvideo",
      quality: "highest",
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    });

    // Save the video/audio to the local file system
    const fileStream = fs.createWriteStream(downloadPath);
    videoStream.pipe(fileStream);

    // Send back a response when download finishes
    fileStream.on("finish", () => {
      console.log(`Download completed: ${downloadPath}`);
      res.download(downloadPath, (err) => {
        if (err) {
          console.error("Error sending file:", err);
          res.status(500).send("Error sending file.");
        } else {
          // After sending, delete the file to clean up
          fs.unlinkSync(downloadPath);
          console.log("File deleted after download.");
        }
      });
    });

    // Handle errors during download
    videoStream.on("error", (err) => {
      console.error("Error downloading video:", err);
      res.status(500).send(`Error downloading video: ${err.message}`);
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send(`Internal server error: ${error.message}`);
  }
});

// Add an OPTIONS handler for CORS preflight requests
app.options("/download", cors());

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});