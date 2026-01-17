
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mapsDir = path.join(__dirname, '../public/maps');
const thumbnailsDir = path.join(mapsDir, 'thumbnails');

if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
}

async function processImages() {
    const files = fs.readdirSync(mapsDir);
    console.log(`Found ${files.length} files in ${mapsDir}`);

    for (const file of files) {
        if (!file.match(/\.(png|jpg|jpeg)$/i)) continue;

        const inputPath = path.join(mapsDir, file);
        const outputFilename = file.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        const outputPath = path.join(thumbnailsDir, outputFilename);

        try {
            await sharp(inputPath)
                .resize(480) // Resize to 480px width (good enough for card backgrounds)
                .webp({ quality: 80 })
                .toFile(outputPath);
            console.log(`Generated: ${outputFilename}`);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
}

processImages();
