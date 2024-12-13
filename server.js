const express = require('express');
const fs = require('fs');
const ytDlp = require('yt-dlp');
const app = express();
const cors = require('cors');
const path = require('path');

// Middlewares
app.use(express.json());
app.use(cors());

// Utility function to get formats
const getFormats = async (url) => {
    try {
        // Use yt-dlp to get available formats for the video
        const output = await ytDlp.getInfo(url, {
            cookies: './cookies.txt', // Use the cookies for authentication
        });
        return output.formats; // Return the list of available formats
    } catch (error) {
        throw new Error('Error fetching formats: ' + error.message);
    }
};

// Endpoint to get available formats
app.post('/formats', async (req, res) => {
    const { url } = req.body;
    try {
        const formats = await getFormats(url);
        res.json({ formats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to download video (if needed for later)
app.post('/download', async (req, res) => {
    const { url, format } = req.body;
    try {
        // Download logic here
        const downloadPath = path.join(__dirname, 'downloads', '%(title)s.%(ext)s');
        await ytDlp.download(url, {
            format: format,
            cookies: './cookies.txt',
            output: downloadPath,
        });
        res.json({ message: 'Download started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
