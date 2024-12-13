// Extensive server code (Node.js with error handling)
const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to fetch video formats
app.post('/getVideoFormats', async (req, res) => {
    const { videoUrl } = req.body;

    // Validate the video URL
    if (!videoUrl || !ytdl.validateURL(videoUrl)) {
        return res.status(400).json({ error: 'Invalid or missing video URL.' });
    }

    try {
        const videoInfo = await ytdl.getInfo(videoUrl);
        const formats = videoInfo.formats.map((format) => ({
            quality: format.qualityLabel,
            mimeType: format.mimeType,
            url: format.url,
        }));

        if (formats.length === 0) {
            return res.status(404).json({ error: 'No available formats for this video.' });
        }

        res.json({ formats });
    } catch (err) {
        console.error('Error fetching video formats:', err);
        res.status(500).json({ error: 'Failed to fetch video formats. Please try again later.' });
    }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
