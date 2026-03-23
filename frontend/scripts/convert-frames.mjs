import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';

const INPUT = 'public/frames';
const OUTPUT = 'public/scroll-frames';
const EVERY_NTH = 1; // Take every frame
const WIDTH = 960;
const QUALITY = 55;

async function main() {
  await mkdir(OUTPUT, { recursive: true });

  const files = (await readdir(INPUT))
    .filter((f) => f.endsWith('.png') || f.endsWith('.jpg'))
    .sort();

  // Take every Nth frame
  const selected = files.filter((_, i) => i % EVERY_NTH === 0);

  console.log(`Total PNGs: ${files.length}`);
  console.log(`Selected (every ${EVERY_NTH}): ${selected.length}`);
  console.log(`Converting to ${WIDTH}px JPEG q${QUALITY}...`);

  let totalBytes = 0;

  for (let i = 0; i < selected.length; i++) {
    const inputPath = join(INPUT, selected[i]);
    const outputName = `f${String(i + 1).padStart(4, '0')}.jpg`;
    const outputPath = join(OUTPUT, outputName);

    const { size } = await sharp(inputPath)
      .resize(WIDTH)
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(outputPath);

    totalBytes += size;

    if ((i + 1) % 20 === 0 || i === selected.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${selected.length} frames (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
    }
  }

  console.log(`\n\nDone! ${selected.length} frames, ${(totalBytes / 1024 / 1024).toFixed(1)}MB total`);
  console.log(`Average: ${Math.round(totalBytes / selected.length / 1024)}KB per frame`);
  console.log(`Output: ${OUTPUT}/`);
}

main().catch(console.error);
