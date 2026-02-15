
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'src-tauri/icons/icon.png');
const outputPath = path.join(__dirname, 'Home Assistant Build.ico');

pngToIco(inputPath)
    .then(buf => {
        fs.writeFileSync(outputPath, buf);
        console.log('Icon created successfully: Home Assistant Build.ico');
    })
    .catch(err => {
        console.error('Error creating ico:', err);
    });
