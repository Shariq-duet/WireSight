/**
 * Helper to generate a complete wiresight_house_wiring.json soft copy.
 */
const fs = require('fs');
const path = require('path');

// Extract from ConduitTypes.ts
const conduitTypesPath = path.join(__dirname, '..', 'MySpecsLens.esproj', 'Assets', 'Scripts', 'ConduitTypes.ts');
const houseEnvPath = path.join(__dirname, '..', 'MySpecsLens.esproj', 'Assets', 'Scripts', 'HouseEnvironment.ts');

const conduitTypesContent = fs.readFileSync(conduitTypesPath, 'utf8');
const houseEnvContent = fs.readFileSync(houseEnvPath, 'utf8');

// Parse runs using regex or eval-like extractor
function extractRunsFromTs(tsCode) {
    const runs = [];
    const runBlocks = tsCode.split(/id:\s*"/);
    for (let i = 1; i < runBlocks.length; i++) {
        const block = runBlocks[i];
        const idMatch = block.match(/^([^"]+)"/);
        if (!idMatch) continue;
        const id = idMatch[1];
        if (id.startsWith("wall-") || id === "kitchen" || id === "living" || id === "bedroom" || id === "utility" || id === "all" || id === "bathroom" || id === "garage" || id === "panel") continue;

        const nameMatch = block.match(/name:\s*"([^"]+)"/);
        const layerMatch = block.match(/layer:\s*"([^"]+)"/);
        const voltageMatch = block.match(/voltageOrType:\s*"([^"]+)"/);
        const statusMatch = block.match(/status:\s*"([^"]+)"/);
        const roomMatch = block.match(/roomZone:\s*"([^"]+)"/);
        const gaugeMatch = block.match(/gauge:\s*"([^"]+)"/);
        const liveMatch = block.match(/isLive:\s*(true|false)/);
        const thickMatch = block.match(/thickness:\s*([0-9.]+)/);
        const colorMatch = block.match(/color:\s*new\s+vec4\(([^)]+)\)/);
        const startMatch = block.match(/startPoint:\s*new\s+vec3\(([^)]+)\)/);
        const endMatch = block.match(/endPoint:\s*new\s+vec3\(([^)]+)\)/);

        if (!startMatch || !endMatch) continue;

        const parseVec3 = str => {
            const parts = str.split(',').map(s => parseFloat(s.trim()));
            return { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0 };
        };
        const parseVec4 = str => {
            if (!str) return { x: 1, y: 0.88, z: 0.2, w: 1 };
            const parts = str.split(',').map(s => parseFloat(s.trim()));
            return { x: parts[0] || 0, y: parts[1] || 0, z: parts[2] || 0, w: parts[3] !== undefined ? parts[3] : 1 };
        };

        runs.push({
            id: id,
            name: nameMatch ? nameMatch[1] : `Conduit ${id}`,
            layer: layerMatch ? layerMatch[1] : "electrical",
            voltageOrType: voltageMatch ? voltageMatch[1] : "120V AC",
            installer: "WireSight Certified",
            installDate: "2026-11-08",
            status: statusMatch ? statusMatch[1] : "ACTIVE",
            color: colorMatch ? parseVec4(colorMatch[1]) : { x: 1, y: 0.88, z: 0.2, w: 1 },
            startPoint: parseVec3(startMatch[1]),
            endPoint: parseVec3(endMatch[1]),
            isWorldCoords: true,
            roomZone: roomMatch ? roomMatch[1] : "Master Bedroom",
            gauge: gaugeMatch ? gaugeMatch[1] : "12 AWG (20A)",
            isLive: liveMatch ? liveMatch[1] === "true" : true,
            thickness: thickMatch ? parseFloat(thickMatch[1]) : 5.5
        });
    }
    return runs;
}

const activeRuns = extractRunsFromTs(conduitTypesContent);
const houseRuns = extractRunsFromTs(houseEnvContent);

// Combine without duplicates
const map = new Map();
activeRuns.forEach(r => map.set(r.id, r));
houseRuns.forEach(r => {
    if (!map.has(r.id)) map.set(r.id, r);
});

const allRuns = Array.from(map.values());
const outPath = path.join(__dirname, '..', 'wiresight_house_wiring.json');
fs.writeFileSync(outPath, JSON.stringify(allRuns, null, 2), 'utf8');

console.log(`Exported ${allRuns.length} total residential wiring runs to: ${outPath}`);

