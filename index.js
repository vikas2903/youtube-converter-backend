const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 7000;  // Railway assigns a dynamic PORT

app.use(cors());

// Serve the downloads folder
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
            
            // ✅ Corrected Download Link (Uses Railway URL)
            const downloadLink = `https://youtube-converter-backend-production.up.railway.app/downloads/${path.basename(outputFile)}`;
            res.json({ success: true, downloadLink });
        });

    } catch (error) {
        console.error("Processing error:", error);
        res.status(500).json({ error: "Processing error", details: error.message });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
