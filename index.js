const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8000;
const backendURL = process.env.BACKEND_URL || `http://localhost:${PORT}`; // Uses env variable if available

app.use(cors());

// Serve the "downloads" folder for static file access
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}
app.use("/downloads", express.static(downloadsDir));

app.get("/download", async (req, res) => {
    try {
        let { url, format } = req.query;

        if (!url || !format) {
            return res.status(400).json({ error: "Missing URL or format" });
        }

        url = decodeURIComponent(url); // Ensure special characters are handled
        format = format.toLowerCase();

        // Generate a unique filename
        const timestamp = Date.now();
        const outputFileBase = path.join(downloadsDir, `output-${timestamp}`);

        // Construct yt-dlp command (using python3)
        let command = `python3 -m yt_dlp -o "${outputFileBase}.%(ext)s"`;
        if (format === "mp3") {
            command += " --extract-audio --audio-format mp3";
        }

        command += ` "${url}"`;

        console.log(`Executing command: ${command}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("Download failed:", stderr);
                return res.status(500).json({ error: "Download error", details: stderr });
            }

            console.log("Download complete, checking files...");

            // Get the actual downloaded file name
            fs.readdir(downloadsDir, (err, files) => {
                if (err) {
                    console.error("Error reading download directory:", err);
                    return res.status(500).json({ error: "Server error" });
                }

                // Find the correct file
                const downloadedFile = files.find(file => file.includes(`output-${timestamp}`));
                if (!downloadedFile) {
                    return res.status(500).json({ error: "File not found after download" });
                }

                // Generate download link
                const downloadLink = `${backendURL}/downloads/${downloadedFile}`;
                res.json({ success: true, downloadLink });
            });
        });

    } catch (error) {
        console.error("Processing error:", error);
        res.status(500).json({ error: "Processing error", details: error.message });
    }
});

app.listen(PORT, () => console.log(`Server running on ${backendURL}`));
