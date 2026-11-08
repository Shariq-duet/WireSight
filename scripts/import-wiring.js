/**
 * WireSight CLI Import Tool
 * Reads and validates any JSON soft copy file and displays stats.
 */
const fs = require('fs');
const path = require('path');

const targetFile = process.argv[2] || path.join(__dirname, '..', 'wiresight_house_wiring.json');

if (!fs.existsSync(targetFile)) {
    console.error(`File not found: ${targetFile}`);
    process.exit(1);
}

try {
    const content = fs.readFileSync(targetFile, 'utf8');
    const runs = JSON.parse(content);

    if (!Array.isArray(runs)) {
        console.error("Error: Soft copy must contain a JSON array of runs.");
        process.exit(1);
    }

    console.log(`\x1b[32m=== WireSight Soft Copy Verification ===\x1b[0m`);
    console.log(`File: ${path.basename(targetFile)}`);
    console.log(`Total Runs: ${runs.length}`);

    const byRoom = {};
    const byLayer = {};
    runs.forEach(r => {
        const room = r.roomZone || "Unassigned";
        byRoom[room] = (byRoom[room] || 0) + 1;
        const layer = r.layer || "electrical";
        byLayer[layer] = (byLayer[layer] || 0) + 1;
    });

    console.log(`\nRuns by Room Zone:`);
    for (const [room, count] of Object.entries(byRoom)) {
        console.log(`  • ${room}: ${count} runs`);
    }

    console.log(`\nRuns by MEP Layer:`);
    for (const [layer, count] of Object.entries(byLayer)) {
        console.log(`  • ${layer}: ${count} runs`);
    }

    console.log(`\n\x1b[36mTo import into Lens Studio:\x1b[0m`);
    console.log(`1. Copy the contents of ${path.basename(targetFile)}`);
    console.log(`2. In Lens Studio, select ConduitXRMain script in Objects panel`);
    console.log(`3. Paste into the "Import Json String" Inspector field`);
    console.log(`4. Press [I] or tap [📥 IMPORT JSON] in Preview!`);
} catch (e) {
    console.error("Invalid JSON:", e.message);
    process.exit(1);
}

