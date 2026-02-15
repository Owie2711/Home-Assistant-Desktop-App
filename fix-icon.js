
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const urls = [
    'https://brands.home-assistant.io/homeassistant/icon.png',
    'https://brands.home-assistant.io/_/homeassistant/icon.png',
    'https://raw.githubusercontent.com/home-assistant/brands/master/core/icon%402x.png'
];

const tempPngPath = path.join(__dirname, 'hass-temp.png');
const outputPath = path.join(__dirname, 'Home Assistant Build.ico');

async function downloadAndConvert() {
    for (const url of urls) {
        try {
            console.log(`Trying to download from ${url}...`);
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            fs.writeFileSync(tempPngPath, response.data);
            console.log('Download complete.');

            console.log('Converting to 256x256 ICO...');
            const buf = await pngToIco(tempPngPath);
            fs.writeFileSync(outputPath, buf);
            console.log('Icon created successfully: Home Assistant Build.ico');

            // Cleanup temp file
            if (fs.existsSync(tempPngPath)) fs.unlinkSync(tempPngPath);
            return; // Success!
        } catch (err) {
            console.log(`Failed with ${url}: ${err.message}`);
        }
    }
    console.error('All download attempts failed.');
}

downloadAndConvert();
