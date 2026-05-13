#!/usr/bin/env node
/**
 * Regenerates every app icon size from a single source PNG.
 *
 * Source: reference/favicon and icon.png (421x421)
 * Targets:
 *   - Android launcher icons (mipmap-mdpi through xxxhdpi):
 *       ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
 *   - Web favicons + PWA icons under src/frontend/public/assets/icons/
 *
 * Run with:  node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'reference', 'favicon and icon.png');

if (!fs.existsSync(SRC)) {
  console.error('Source icon not found at:', SRC);
  process.exit(1);
}

// Standard Android launcher icon densities. The "foreground" layer needs a
// bit of safe-zone padding (the round/launcher renders cropped) so we keep
// it the same as ic_launcher for now — replace with a dedicated transparent
// foreground PNG later if desired.
const ANDROID_DENSITIES = [
  { dir: 'mipmap-mdpi',    size:  48 },
  { dir: 'mipmap-hdpi',    size:  72 },
  { dir: 'mipmap-xhdpi',   size:  96 },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const WEB_ICONS = [
  { name: 'favicon-16.png',       size:  16 },
  { name: 'favicon-32.png',       size:  32 },
  { name: 'favicon-48.png',       size:  48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png',         size: 192 },
  { name: 'icon-512.png',         size: 512 },
];

async function generate() {
  const baseDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
  const webDir  = path.join(ROOT, 'src', 'frontend', 'public', 'assets', 'icons');

  // Android: write ic_launcher.png + ic_launcher_round.png + ic_launcher_foreground.png
  // for each density. All three are the same image right now.
  for (const { dir, size } of ANDROID_DENSITIES) {
    const out = path.join(baseDir, dir);
    if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
    const buffer = await sharp(SRC).resize(size, size, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
    await fs.promises.writeFile(path.join(out, 'ic_launcher.png'), buffer);
    await fs.promises.writeFile(path.join(out, 'ic_launcher_round.png'), buffer);
    await fs.promises.writeFile(path.join(out, 'ic_launcher_foreground.png'), buffer);
    console.log('android', dir, '->', size + 'x' + size);
  }

  // Web favicons + PWA icons
  for (const { name, size } of WEB_ICONS) {
    const buffer = await sharp(SRC).resize(size, size, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).png().toBuffer();
    await fs.promises.writeFile(path.join(webDir, name), buffer);
    console.log('web', name, '->', size + 'x' + size);
  }

  // favicon.ico — pack 16/32/48 into one .ico file. Sharp doesn't ship with
  // ICO encoding by default, so we just copy the 48px PNG renamed; modern
  // browsers accept PNGs in <link rel="icon" type="image/x-icon">. If a
  // strict .ico is needed, generate via favicon.io once and paste in.
  const ico48 = await sharp(SRC).resize(48, 48).png().toBuffer();
  await fs.promises.writeFile(path.join(webDir, 'favicon.ico'), ico48);
  console.log('web favicon.ico -> 48x48 (PNG-as-ICO; replace with real ICO if needed)');

  console.log('\nDone.');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
