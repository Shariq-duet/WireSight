/**
 * WireSight CLI Export Tool
 * Extracts the latest exported JSON soft copy from Lens Studio logs
 * and saves it to wiresight_saved_wiring.json.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const logDir = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Snap', 'Lens Studio', 'logs');

if (!fs.existsSync(logDir)) {
    console.error("Lens Studio log directory not found at:", logDir);
    process.exit(1);
}

const files = fs.readdirSync(logDir)
    .filter(f => f.startsWith('LensStudioLog-'))
    .map(f => path.join(logDir, f))
    .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);

if (files.length === 0) {
    console.error("No Lens Studio log files found.");
    process.exit(1);
}

const latestLog = files[0];
console.log(`Reading latest Lens Studio log: ${path.basename(latestLog)}...`);
const logContent = fs.readFileSync(latestLog, 'utf8');

const startTag = "[WIRESIGHT_JSON_EXPORT_START]";
const endTag = "[WIRESIGHT_JSON_EXPORT_END]";

const startIdx = logContent.lastIndexOf(startTag);
const endIdx = logContent.lastIndexOf(endTag);

if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonStr = logContent.slice(startIdx + startTag.length, endIdx).trim();
    try {
        const parsed = JSON.parse(jsonStr);
        const outPath = path.join(__dirname, '..', 'wiresight_saved_wiring.json');
        fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), 'utf8');
        console.log(`\x1b[32m✓ Successfully exported ${parsed.length} runs to: ${outPath}\x1b[0m`);
    } catch (e) {
        console.error("Failed to parse JSON from log:", e.message);
    }
} else {
    console.log("No JSON export tags found in latest log. Press [E] or tap [📤 EXPORT JSON] in Lens Studio first!");
    console.log(`Default soft copy is available at: wiresight_house_wiring.json`);
}

