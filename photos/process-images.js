#!/usr/bin/env node
// Usage: node process-images.js
// Reads all images from ./original, writes sized/converted derivatives to ./edit

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = "originals";
const OUT_DIR = "edits";
const EXTENSIONS = [".jpg", ".jpeg", ".png"];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(SRC_DIR).filter((f) =>
    EXTENSIONS.includes(path.extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.log(`No images found in ./${SRC_DIR}`);
    return;
  }

  for (const file of files) {
    const name = path.parse(file).name;
    const inputPath = path.join(SRC_DIR, file);
    console.log(`Processing ${file}...`);

    try {
      const img = sharp(inputPath);

      await img.clone().resize(1600).avif().toFile(path.join(OUT_DIR, `${name}-web.avif`));
      await img.clone().resize(1600).webp().toFile(path.join(OUT_DIR, `${name}-web.webp`));
      await img.clone().resize(1600).jpeg({ quality: 80 }).toFile(path.join(OUT_DIR, `${name}-web.jpg`));
      await img.clone().resize(400).webp().toFile(path.join(OUT_DIR, `${name}-thumb.webp`));

      console.log(`  done: ${name}`);
    } catch (err) {
      console.error(`  failed: ${file} — ${err.message}`);
    }
  }

  console.log(`\nProcessed ${files.length} image(s) into ./${OUT_DIR}`);
}

main();