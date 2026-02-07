import fs from 'fs';
import path from 'path';
import https from 'https';

// Use Roboto from jsDelivr CDN (fontsource package)
const url = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-normal.ttf';
const dest = path.join(process.cwd(), 'fonts', 'Roboto-Bold.ttf');

console.log(`Downloading font from ${url} to ${dest}`);

const file = fs.createWriteStream(dest);
https.get(url, function (response) {
    if (response.statusCode !== 200) {
        console.error(`Failed to download: ${response.statusCode} ${response.statusMessage}`);
        return;
    }
    response.pipe(file);
    file.on('finish', function () {
        file.close(() => {
            console.log('Download completed.');
            const stats = fs.statSync(dest);
            console.log(`File size: ${stats.size} bytes`);
        });
    });
}).on('error', function (err) {
    fs.unlink(dest, () => { });
    console.error('Error downloading font:', err.message);
});
