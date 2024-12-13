const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Endpoint to get available formats
app.post('/get-formats', (req, res) => {
    const url = req.body.url;

    // Run yt-dlp with the --list-formats option
    exec(`yt-dlp ${url} --list-formats`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send({ error: 'Error fetching formats' });
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return res.status(500).send({ error: 'Error fetching formats' });
        }

        // Parse the available formats
        const formats = stdout.split('\n').map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 6) return null; // Skip lines that don't have valid format data
            return {
                id: parts[0],
                ext: parts[1],
                resolution: parts[2],
                fps: parts[3],
                size: parts[4],
                codec: parts[5]
            };
        }).filter(format => format !== null);

        res.send({ formats });
    });
});

// Endpoint to download the video
app.post('/download', (req, res) => {
    const url = req.body.url;
    const format = req.body.format;

    // Run yt-dlp to download the selected format
    exec(`yt-dlp ${url} -f ${format} -o '~/downloads/%(title)s.%(ext)s'`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).send({ error: 'Error downloading the video' });
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return res.status(500).send({ error: 'Error downloading the video' });
        }

        res.send({ message: 'Download started successfully', output: stdout });
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
});
