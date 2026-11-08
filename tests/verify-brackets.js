const fs = require('fs');
const path = require('path');
const dir = 'MySpecsLens.esproj/Assets/Scripts';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

function checkBalance(content) {
    let curly = 0, square = 0, paren = 0;
    let inString = null;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < content.length; i++) {
        const c = content[i];
        const next = content[i+1];

        if (inLineComment) {
            if (c === '\n') inLineComment = false;
            continue;
        }
        if (inBlockComment) {
            if (c === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }
        if (inString) {
            if (c === '\\') {
                i++; // escape next char
                continue;
            }
            if (c === inString) {
                inString = null;
            }
            continue;
        }

        // Check comment starts
        if (c === '/' && next === '/') {
            inLineComment = true;
            i++;
            continue;
        }
        if (c === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }

        // Check string starts
        if (c === '"' || c === "'" || c === '`') {
            inString = c;
            continue;
        }

        if (c === '{') curly++;
        else if (c === '}') curly--;
        else if (c === '[') square++;
        else if (c === ']') square--;
        else if (c === '(') paren++;
        else if (c === ')') paren--;

        if (curly < 0 || square < 0 || paren < 0) {
            return { ok: false, msg: `Negative balance at char ${i} ('${c}')`, curly, square, paren };
        }
    }
    return { ok: curly === 0 && square === 0 && paren === 0, curly, square, paren };
}

let allOk = true;
for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const res = checkBalance(content);
    if (!res.ok) {
        console.error(`FAILED ${file}:`, res);
        allOk = false;
    } else {
        console.log(`${file} -> 100% Balanced!`);
    }

    // Check parameterless vector constructors
    const paramless = content.match(/new\s+(?:vec3|vec4|vec2)\s*\(\s*\)/g);
    if (paramless) {
        console.error(`Found parameterless constructor in ${file}: ${paramless.join(', ')}`);
        allOk = false;
    }
}

if (allOk) {
    console.log(">>> ALL 9 SCRIPTS 100% BALANCED & ZERO PARAMETERLESS CONSTRUCTORS! <<<");
} else {
    process.exit(1);
}

