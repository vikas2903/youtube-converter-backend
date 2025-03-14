
// const express = require("express");
// const cors = require("cors");
// const ytdl = require("youtube-dl-exec");
// const fs = require("fs");
// const path = require("path");

// const app = express();
// app.use(cors());

// // Serve the downloads folder as a static directory
// app.use("/downloads", express.static(path.join(__dirname, "downloads")));

// app.get("/download", async (req, res) => {
//     try {
//         console.log("Received request:", req.query);

//         const { url, format } = req.query;
//         if (!url || !format) {
//             return res.status(400).json({ error: "Missing URL or format" });
//         }

//         // Ensure the downloads directory exists
//         const downloadsDir = path.join(__dirname, "downloads");
//         if (!fs.existsSync(downloadsDir)) {
//             fs.mkdirSync(downloadsDir);
//         }

//         // Generate a unique filename
//         const timestamp = Date.now();
//         const outputFile = path.join(downloadsDir, `output-${timestamp}.${format}`);

//         console.log(`Downloading ${format}...`);
//         await ytdl(url, {
//             output: outputFile,
//             extractAudio: format === "mp3",
//             audioFormat: format === "mp3" ? "mp3" : undefined,
//         });

//         // Provide a direct link instead of sending the file immediately
//         const fileLink = `http://localhost:7000/downloads/${path.basename(outputFile)}`;
//         console.log("Download ready at:", fileLink);

//         res.json({ success: true, downloadLink: fileLink });

//     } catch (error) {
//         console.error("Processing error:", error);
//         res.status(500).json({ error: "Processing error", details: error.message });
//     }
// });

// app.listen(7000, () => console.log("Server running on port 7000"));


const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use("/downloads", express.static(path.join(__dirname, "downloads")));

app.get("/download", async (req, res) => {
    try {
        const { url, format } = req.query;
        if (!url || !format) {
            return res.status(400).json({ error: "Missing URL or format" });
        }

        const downloadsDir = path.join(__dirname, "downloads");
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir);
        }

        const timestamp = Date.now();
        const outputFile = path.join(downloadsDir, `output-${timestamp}.${format}`);

        console.log(`Downloading ${format}...`);
        const command = `yt-dlp -o "${outputFile}" ${format === "mp3" ? "--extract-audio --audio-format mp3" : ""} "${url}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("Download failed:", error);
                return res.status(500).json({ error: "Download error", details: stderr });
            }
            res.json({ success: true, downloadLink: `http://localhost:7000/downloads/${path.basename(outputFile)}` });
        });

    } catch (error) {
        console.error("Processing error:", error);
        res.status(500).json({ error: "Processing error", details: error.message });
    }
});

app.listen(7000, () => console.log("Server running on port 7000"));
console.log("Server running on port 7000");