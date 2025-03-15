const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const youtubeDl = require('youtube-dl-exec');

const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_URL = "https://youtube-converter-backend-cu2n.onrender.com"; // Render-hosted URL

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Route: Convert YouTube Video to MP3
app.get('/convert', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).json({ error: 'No URL provided' });
        }

        const videoId = videoUrl.split('v=')[1]?.split('&')[0] || new Date().getTime();
        const outputFilePath = path.join(downloadsDir, `${videoId}.mp3`);
        const tempFilePath = path.join(downloadsDir, `${videoId}.mp4`);

        // Check if file already exists
        if (fs.existsSync(outputFilePath)) {
            return res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
        }

        console.log(`🔹 Downloading video: ${videoUrl}`);

        // Download YouTube audio using youtube-dl with Visitor Data bypass
        await youtubeDl(videoUrl, {
            output: tempFilePath,
            format: 'bestaudio',
            extractorArgs: [
                "youtubetab:skip=webpage",
                "youtube:player_skip=webpage,configs;visitor_data=VISITOR_DATA"
            ]
        });

        console.log('✅ Download complete. Converting to MP3...');

        // Convert to MP3 using FFmpeg
        ffmpeg(tempFilePath)
            .audioBitrate(128)
            .toFormat('mp3')
            .save(outputFilePath)
            .on('end', () => {
                console.log(`✅ Conversion completed: ${outputFilePath}`);
                fs.unlinkSync(tempFilePath); // Delete temporary file
                res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
            })
            .on('error', err => {
                console.error(`❌ FFmpeg error: ${err.message}`);
                res.status(500).json({ error: 'Error converting the file' });
            });

    } catch (error) {
        console.error(`❌ Server error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Server is running at: ${SERVER_URL}`);
});
