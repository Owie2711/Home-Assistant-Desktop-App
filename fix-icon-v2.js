
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const urls = [
    'https://raw.githubusercontent.com/home-assistant/assets/master/logo/logo.png',
    'https://raw.githubusercontent.com/home-assistant/assets/master/logo/logo-512.png',
    'https://raw.githubusercontent.com/home-assistant/assets/master/logo-logo.png',
    'https://brands.home-assistant.io/homeassistant/logo.png',
    'https://brands.home-assistant.io/homeassistant/icon.png'
];

async function findAndConvert() {
    for (const url of urls) {
        try {
            console.log(`Checking ${url}...`);
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const tempPngPath = path.join(__dirname, 'hass-icon-temp.png');
            fs.writeFileSync(tempPngPath, response.data);
            console.log(`Downloaded from ${url}`);

            const outputPath = path.join(__dirname, 'Home Assistant Build.ico');
            const buf = await pngToIco(tempPngPath);
            fs.writeFileSync(outputPath, buf);
            console.log(`Icon created successfully: ${outputPath}`);

            if (fs.existsSync(tempPngPath)) fs.unlinkSync(tempPngPath);
            return;
        } catch (err) {
            console.log(`Failed ${url}: ${err.message}`);
        }
    }
    console.error('Could not find a working logo URL');
}

findAndConvert();
