
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import React from 'react';

async function test() {
    console.log('--- Starting Satori Font Test ---');

    const fontPath = path.join(process.cwd(), 'fonts', 'Roboto-Bold.ttf');
    console.log(`Checking font at: ${fontPath}`);

    if (!fs.existsSync(fontPath)) {
        console.error('❌ Font file does not exist!');
        process.exit(1);
    }

    const fontData = fs.readFileSync(fontPath);
    console.log(`File size: ${fontData.length} bytes`);

    // Check signature
    const header = fontData.slice(0, 4).toString('hex');
    console.log(`File header (hex): ${header}`);

    // TTF often starts with 00010000
    // OTF starts with 4f54544f (OTTO)
    // WOFF starts with 774f4646 (wOFF)
    // WOFF2 starts with 774f4632 (wOF2)

    if (header === '774f4632') {
        console.error('❌ Error: This is a WOFF2 file, not a TTF/OTF! Satori cannot read compressed WOFF2.');
        process.exit(1);
    }

    try {
        console.log('Attempting to generate image with Satori...');
        const element = React.createElement('div', {
            style: {
                display: 'flex',
                color: 'black',
                backgroundColor: 'white',
                height: '100%',
                width: '100%',
                fontSize: 40,
                alignItems: 'center',
                justifyContent: 'center'
            }
        }, 'Hello World');

        const svg = await satori(element, {
            width: 400,
            height: 200,
            fonts: [{
                name: 'Roboto',
                data: fontData,
                weight: 700,
                style: 'normal'
            }]
        });

        console.log('✅ Satori SVG generation successful!');

        const resvg = new Resvg(svg);
        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        console.log(`✅ PNG generated, size: ${pngBuffer.length} bytes`);
        console.log('Test Passed.');

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

test();
