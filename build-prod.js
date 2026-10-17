const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

async function build() {
    console.log('--- 1. PREPARING DIST DIRECTORY ---');
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST, { recursive: true });
    fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

    console.log('--- 2. CONCATENATING & MINIFYING STYLES ---');
    const cssFiles = [
        'styles/app-shell.css',
        'styles/form-presets.css',
        'styles/report-base.css',
        'styles/report-themes.css',
        'styles/app-themes.css'
    ];
    let combinedCss = '';
    for (const f of cssFiles) {
        combinedCss += fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n';
    }
    const minifiedCss = new CleanCSS({ level: 2 }).minify(combinedCss).styles;
    fs.writeFileSync(path.join(DIST, 'assets', 'app.min.css'), minifiedCss);
    console.log(`[CSS] Bundled & minified to dist/assets/app.min.css (${(minifiedCss.length / 1024).toFixed(1)} KB)`);

    // Also minify print.css
    const printCss = fs.readFileSync(path.join(ROOT, 'styles/print.css'), 'utf8');
    const minPrintCss = new CleanCSS({ level: 2 }).minify(printCss).styles;
    fs.writeFileSync(path.join(DIST, 'assets', 'print.min.css'), minPrintCss);

    console.log('--- 3. BUNDLING & OBFUSCATING SCRIPTS ---');
    // Scripts in precise dependency order
    const jsFiles = [
        'Modules/storage.js',
        'Modules/state.js',
        'Modules/aio.js',
        'Modules/data-models.js',
        'Modules/migrate.js',
        'Modules/photos-idb.js',
        'Modules/backup.js',
        'Modules/ui.js',
        'Modules/calc.js',
        'Modules/qr.js',
        'Modules/sigpad.js',
        'Modules/ui-builders.js',
        'Modules/renderer.js',
        'Modules/batch.js',
        'Modules/app.js'
    ];

    let combinedJs = '';
    for (const f of jsFiles) {
        combinedJs += `/* ${path.basename(f)} */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;';
    }

    console.log('Obfuscating JavaScript (Control-flow flattening, string array encryption, dead code injection)...');
    const obfuscationResult = JavaScriptObfuscator.obfuscate(combinedJs, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: false,
        debugProtection: false, // Allows user to use DevTools without crashing tab
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        renameGlobals: false, // Essential to keep window.* and HTML onclick handlers working!
        rotateStringArray: true,
        selfDefending: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.8,
        transformObjectKeys: false,
        unicodeEscapeSequence: false
    });

    const obfuscatedJs = obfuscationResult.getObfuscatedCode();
    fs.writeFileSync(path.join(DIST, 'assets', 'app.min.js'), obfuscatedJs);
    console.log(`[JS] Bundled & obfuscated to dist/assets/app.min.js (${(obfuscatedJs.length / 1024).toFixed(1)} KB)`);

    console.log('--- 4. PROCESSING HTML ---');
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    // Replace CSS links with single app.min.css and print.min.css
    html = html.replace(/<link rel="stylesheet" href="styles\/app-shell\.css">[\s\S]*?<link rel="stylesheet" href="styles\/print\.css" media="print">/, 
        '<link rel="stylesheet" href="assets/app.min.css">\n\t\t<link rel="stylesheet" href="assets/print.min.css" media="print">');

    // Replace head script tags
    html = html.replace(/<script src="Modules\/storage\.js"><\/script>\s*<script src="Modules\/state\.js"><\/script>\s*<script src="Modules\/aio\.js"><\/script>/, '');

    // Replace body end script tags with single app.min.js
    html = html.replace(/<script src="Modules\/data-models\.js"><\/script>[\s\S]*?<script src="Modules\/app\.js"><\/script>/,
        '<script src="assets/app.min.js"></script>');

    const minHtml = await minifyHtml(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: true
    });

    fs.writeFileSync(path.join(DIST, 'index.html'), minHtml);
    console.log(`[HTML] Minified to dist/index.html (${(minHtml.length / 1024).toFixed(1)} KB)`);

    console.log('--- BUILD COMPLETED SUCCESSFULLY ---');
    console.log('All source folders (Modules/, styles/) are hidden. Output is contained in dist/');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
