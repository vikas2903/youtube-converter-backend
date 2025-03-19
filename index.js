const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const youtubeDl = require("youtube-dl-exec");

const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`; // Auto-detect local or live

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

// Function to handle YouTube download retries




// async function downloadWithRetries(videoUrl, tempFilePath, maxRetries = 3) {
//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       console.log(`🔹 Attempt ${attempt}: Downloading video...`);
//       const ytOptions = {
//         output: tempFilePath.replace(/\.[^.]+$/, ""), // Remove extension
//         format: "bestaudio",
//         addHeader: [
//           "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
//           "Referer: https://www.youtube.com/",
//         ],
//         throttledRate: "500K", // Reduce speed to avoid 429 error
//       };

//       if (useCookies) {
//         ytOptions.cookies = cookiesPath;
//       } else {
//         ytOptions.cookiesFromBrowser = "chrome"; // Try Chrome cookies if cookies.txt fails
//       }

//       // Execute yt-dlp and wait for it to finish
//       const { stderr } = await youtubeDl(videoUrl, ytOptions);
      
//       // Debugging yt-dlp output
//       if (stderr) {
//         console.error(`❌ yt-dlp stderr (Attempt ${attempt}): ${stderr}`);
//       }

//       // Check if file was created
//       const downloadedFiles = fs.readdirSync(downloadsDir).filter(file => file.includes(path.basename(tempFilePath)));
//       if (downloadedFiles.length === 0) {
//         throw new Error("yt-dlp did not create any file.");
//       }

//       return path.join(downloadsDir, downloadedFiles[0]); // Return correct temp file path

//     } catch (ytError) {
//       console.error(`❌ yt-dlp error (Attempt ${attempt}): ${ytError.message}`);

//       if (ytError.message.includes("Sign in to confirm you’re not a bot")) {
//         throw new Error("YouTube requires authentication. Update cookies.txt and try again.");
//       }

//       if (ytError.message.includes("HTTP Error 429")) {
//         console.log("⏳ Rate limit reached, waiting before retrying...");
//         await new Promise(res => setTimeout(res, 30000 * attempt)); // Exponential backoff (30s, 60s, 90s)
//       }

//       if (ytError.message.includes("HTTP Error 403") || ytError.message.includes("HTTP Error 404")) {
//         throw new Error("YouTube video is restricted or not found.");
//       }

//       if (attempt === maxRetries) throw new Error("YouTube download failed after multiple attempts.");
//     }
//   }
// }


async function downloadAudio(videoUrl, tempFilePath) {
  const cookiesPath = '/etc/secrets/YOUTUBE_COOKIES';  // Path to Render secret
  return new Promise((resolve, reject) => {
    const command = `yt-dlp --cookies "${cookiesPath}" -f bestaudio --output "${tempFilePath}" ${videoUrl}`;
    
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
    const tempFilePath = path.join(downloadsDir, `${videoId}.webm`); // Use webm for audio

    // Serve cached MP3 file if it exists
    if (fs.existsSync(outputFilePath)) {
      console.log(`♻️ Serving cached file: ${outputFilePath}`);
      return res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
    }

    console.log(`🔹 Downloading video: ${videoUrl}`);
    const actualTempFile = await downloadAudio(videoUrl, tempFilePath);

    console.log("✅ Download complete. Converting to MP3...");

    // Convert to MP3 using FFmpeg
    ffmpeg(actualTempFile)
      .audioBitrate(128)
      .toFormat("mp3")
      .save(outputFilePath)
      .on("end", () => {
        console.log(`✅ Conversion completed: ${outputFilePath}`);
        fs.unlinkSync(actualTempFile); // Delete temporary file
        res.json({ downloadUrl: `${SERVER_URL}/downloads/${videoId}.mp3` });
      })
      .on("error", (err) => {
        console.error(`❌ FFmpeg error: ${err.message}`);
        res.status(500).json({ error: "Error converting the file" });
      });

  } catch (error) {
    console.error(`❌ Server error: ${error.message}`);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running at: ${SERVER_URL}`);
});
