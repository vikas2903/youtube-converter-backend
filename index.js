const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 7000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware
app.use(cors());
app.use(express.json());
app.use("/downloads", express.static(path.join(__dirname, "downloads")));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Function to download YouTube audio
async function downloadAudio(videoUrl, tempFilePath) {
  return new Promise((resolve, reject) => {
    const command = `yt-dlp -f bestaudio --output \"${tempFilePath}\" ${videoUrl}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`yt-dlp error: ${stderr}`);
        return reject(new Error("YouTube download failed"));
      }
      console.log(`yt-dlp success: ${stdout}`);
      resolve(tempFilePath);
    });
  });
}

app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.status(400).json({ error: "No URL provided" });
    }

    const videoId = new URL(videoUrl).searchParams.get("v") || Date.now();
    const outputFilePath = path.join(downloadsDir, `${videoId}.mp3`);
    const tempFilePath = path.join(downloadsDir, `${videoId}.webm`);

    if (fs.existsSync(outputFilePath)) {
      return res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
    }

    console.log(`Downloading: ${videoUrl}`);
    await downloadAudio(videoUrl, tempFilePath);

    console.log("Converting to MP3...");
    ffmpeg(tempFilePath)
      .audioBitrate(128)
      .toFormat("mp3")
      .save(outputFilePath)
      .on("end", () => {
        fs.unlinkSync(tempFilePath);
        res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
      })
      .on("error", (err) => {
        console.error(`FFmpeg error: ${err.message}`);
        res.status(500).json({ error: "Error converting file" });
      });
  } catch (error) {
    console.error(`Server error: ${error.message}`);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at: ${SERVER_URL}`);
});