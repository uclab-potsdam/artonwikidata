#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_DIR = process.argv[2] || './images';
const OUTPUT_FILE = process.argv[3] || 'composite.avif';
const MAX_SIZE = 4000;

async function createComposite() {
  // Get all image files
  const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.avif'];
  
  console.log(`Scanning directory: ${path.resolve(INPUT_DIR)}`);
  
  const allFiles = fs.readdirSync(INPUT_DIR);
  console.log(`Total files in directory: ${allFiles.length}`);
  
  const files = allFiles
    .filter(f => extensions.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(INPUT_DIR, f));

  console.log(`Found ${files.length} images`);

  if (files.length === 0) {
    console.error('No images found! Check that the directory contains image files.');
    console.log('Looking for extensions:', extensions.join(', '));
    console.log('First 10 files in directory:', allFiles.slice(0, 10));
    process.exit(1);
  }

  // Shuffle the files randomly
  for (let i = files.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [files[i], files[j]] = [files[j], files[i]];
  }

  // Calculate grid dimensions
  // For a square grid, we need ceil(sqrt(n)) cells per side
  const gridSize = Math.ceil(Math.sqrt(files.length));
  const cellSize = Math.floor(MAX_SIZE / gridSize);
  const finalSize = cellSize * gridSize;

  console.log(`Grid: ${gridSize}x${gridSize} = ${gridSize * gridSize} cells`);
  console.log(`Cell size: ${cellSize}px`);
  console.log(`Final image: ${finalSize}x${finalSize}px`);

  // Limit to what fits in the grid
  const usedFiles = files.slice(0, gridSize * gridSize);
  console.log(`Using ${usedFiles.length} images`);

  // Process images in batches to avoid memory issues
  const BATCH_SIZE = 500;
  const composites = [];

  for (let i = 0; i < usedFiles.length; i += BATCH_SIZE) {
    const batch = usedFiles.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(usedFiles.length / BATCH_SIZE)}...`);

    const batchResults = await Promise.all(
      batch.map(async (file, batchIndex) => {
        const globalIndex = i + batchIndex;
        const row = Math.floor(globalIndex / gridSize);
        const col = globalIndex % gridSize;

        try {
          const thumbnail = await sharp(file)
            .resize(cellSize, cellSize, { fit: 'cover' })
            .toBuffer();

          return {
            input: thumbnail,
            left: col * cellSize,
            top: row * cellSize
          };
        } catch (err) {
          console.error(`Error processing ${file}: ${err.message}`);
          return null;
        }
      })
    );

    composites.push(...batchResults.filter(r => r !== null));
  }

  console.log(`Compositing ${composites.length} images...`);

  // Create the final composite
  await sharp({
    create: {
      width: finalSize,
      height: finalSize,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  })
    .composite(composites)
    .avif({ quality: 50 })
    .toFile(OUTPUT_FILE);

  console.log(`Done! Saved to ${OUTPUT_FILE}`);
}

createComposite().catch(console.error);