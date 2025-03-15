const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const youtubeDl = require("youtube-dl-exec");

const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_URL = "https://youtube-converter-backend-cu2n.onrender.com"; // Your Render-hosted backend URL

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

// Path to cookies.txt file
const cookiesPath = path.join(__dirname, "cookies.txt");
const useCookies = fs.existsSync(cookiesPath);

if (useCookies) {
  console.log(`✅ Using cookies from: ${cookiesPath}`);
} else {
  console.log(`⚠️ No cookies.txt file found. Some videos may require authentication.`);
}

app.get("/convert", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.status(400).json({ error: "No URL provided" });
    }

    const videoId = videoUrl.split("v=")[1]?.split("&")[0] || new Date().getTime();
    const outputFilePath = path.join(downloadsDir, `${videoId}.mp3`);
    const tempFilePath = path.join(downloadsDir, `${videoId}.mp4`);

    // Check if MP3 file already exists (serve cached version)
    if (fs.existsSync(outputFilePath)) {
      console.log(`♻️ Serving cached file: ${outputFilePath}`);
      return res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
    }

    console.log(`🔹 Downloading video: ${videoUrl}`);

    // Download YouTube audio using yt-dlp with cookies and headers
    try {
      const ytOptions = {
        output: tempFilePath,
        format: "bestaudio",
        addHeader: [
          "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
          "Referer: https://www.youtube.com/",
        ],
        throttledRate: "1M", // Prevents 429 error by limiting speed
      };

      // Use cookies only if available
      if (useCookies) {
        ytOptions.cookies = cookiesPath;
      }

      await youtubeDl(videoUrl, ytOptions);
    } catch (ytError) {
      console.error(`❌ yt-dlp error: ${ytError.message}`);

      // Detect CAPTCHA error (requires authentication)
      if (ytError.message.includes("Sign in to confirm you’re not a bot")) {
        return res.status(403).json({
          error: "YouTube requires authentication. Check cookies.txt and try again.",
        });
      }

      // Detect Rate Limit (HTTP 429)
      if (ytError.message.includes("HTTP Error 429")) {
        return res.status(429).json({
          error: "Too many requests. Please wait a few minutes and try again.",
        });
      }

      return res.status(500).json({ error: "YouTube download failed. Try updating cookies.txt" });
    }

    console.log("✅ Download complete. Converting to MP3...");

    // Convert to MP3 using FFmpeg
    ffmpeg(tempFilePath)
      .audioBitrate(128)
      .toFormat("mp3")
      .save(outputFilePath)
      .on("end", () => {
        console.log(`✅ Conversion completed: ${outputFilePath}`);
        fs.unlinkSync(tempFilePath); // Delete temporary .mp4 file
        res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
      })
      .on("error", (err) => {
        console.error(`❌ FFmpeg error: ${err.message}`);
        res.status(500).json({ error: "Error converting the file" });
      });

  } catch (error) {
    console.error(`❌ Server error: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running at: ${SERVER_URL}`);
});
