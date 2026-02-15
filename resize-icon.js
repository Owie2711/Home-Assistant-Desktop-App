
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'Home Assistant.ico');
const outputPath = path.join(__dirname, 'Home Assistant 256.ico');

async function resizeIcon() {
    try {
        console.log('Resizing icon...');
        await sharp(inputPath)
            .resize(256, 256, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toFile(outputPath);
        console.log('Icon resized successfully to 256x256: Home Assistant 256.ico');
    } catch (err) {
        console.error('Error resizing icon:', err);
    }
}

resizeIcon();
