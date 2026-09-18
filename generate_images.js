import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateImages() {
  const outputDir = path.join(__dirname, 'public', 'assets', 'puzzle');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const width = 400;
  const height = 400;

  for (let i = 1; i <= 9; i++) {
    // Determine background color based on position (checkerboard/gradient effect)
    const color = i % 2 === 0 ? 0x222222ff : 0x444444ff;
    
    // Create new image
    const image = new Jimp({ width, height, color });

    // Try to load a font and print the number
    try {
      const font = await loadFont(Jimp.FONT_SANS_64_WHITE);
      // Roughly center the text
      image.print({
        font,
        x: 0,
        y: height / 2 - 32,
        text: String(i),
        alignmentX: 'center',
        alignmentY: 'middle'
      });
    } catch (e) {
      console.warn('Could not print font for', i, e.message);
    }

    const filepath = path.join(outputDir, `image${i}.png`);
    await image.write(filepath);
    console.log(`Generated ${filepath}`);
  }
}

generateImages().catch(console.error);
