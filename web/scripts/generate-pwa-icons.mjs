import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourceLogo = path.join(root, "public", "kael-logo-fix.png");
const publicDir = path.join(root, "public");
const appDir = path.join(root, "src", "app");

/**
 * Generates an ultra-smooth 512x512 background buffer with dither noise
 * to prevent 8-bit color banding on dark obsidian/violet gradients.
 */
function createSmoothBackground(w = 512, h = 512) {
  const raw = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const tY = y / h; // 0 to 1

      // Base gradient: top rich dark midnight (#1b1530) to bottom deep obsidian (#07050d)
      let r = 27 * (1 - tY) + 7 * tY;
      let g = 21 * (1 - tY) + 5 * tY;
      let b = 48 * (1 - tY) + 13 * tY;

      // Violet ambient glow around center-top (cx=240, cy=220)
      const dV = Math.hypot(x - 240, y - 220) / 230;
      if (dV < 1) {
        const factor = Math.cos(dV * Math.PI * 0.5) * 0.38;
        r += 121 * factor;
        g += 88 * factor;
        b += 216 * factor;
      }

      // Electric Lime ambient glow around top-right arch (x=350, y=160)
      const dL = Math.hypot(x - 350, y - 160) / 130;
      if (dL < 1) {
        const factor = Math.cos(dL * Math.PI * 0.5) * 0.20;
        r += 207 * factor;
        g += 240 * factor;
        b += 64 * factor;
      }

      // Subtle lime bounce on bottom-left dots (x=160, y=370)
      const dLb = Math.hypot(x - 160, y - 370) / 110;
      if (dLb < 1) {
        const factor = Math.cos(dLb * Math.PI * 0.5) * 0.14;
        r += 207 * factor;
        g += 240 * factor;
        b += 64 * factor;
      }

      // Triangular dither noise (+/- 0.7) to eliminate banding completely
      const noise = (Math.random() - Math.random()) * 0.75;

      raw[idx] = Math.min(255, Math.max(0, Math.round(r + noise)));
      raw[idx + 1] = Math.min(255, Math.max(0, Math.round(g + noise)));
      raw[idx + 2] = Math.min(255, Math.max(0, Math.round(b + noise)));
      raw[idx + 3] = 255;
    }
  }

  return sharp(raw, { raw: { width: w, height: h, channels: 4 } });
}

function createSquircleRimSvg() {
  return `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rimStroke" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
          <stop offset="30%" stop-color="#7958d8" stop-opacity="0.45"/>
          <stop offset="70%" stop-color="#7958d8" stop-opacity="0.20"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="108" ry="108" stroke="url(#rimStroke)" stroke-width="2" fill="none"/>
    </svg>
  `;
}

async function generateAllIcons() {
  console.log("Generating premium PWA icons from:", sourceLogo);

  const logoMeta = await sharp(sourceLogo).metadata();
  console.log("Original logo dimensions:", logoMeta.width, "x", logoMeta.height);

  // Safe-zone compliant dimensions for 512 canvas:
  // Height = 286px, Width = 256px
  // Max diagonal distance from center = 191px (Safe circle = 205px radius)
  const emblemH = 286;
  const emblemW = Math.round((logoMeta.width / logoMeta.height) * emblemH);
  const topPos = Math.round((512 - emblemH) / 2);
  const leftPos = Math.round((512 - emblemW) / 2);

  const emblemPng = await sharp(sourceLogo)
    .resize(emblemW, emblemH, { fit: "contain" })
    .png()
    .toBuffer();

  const emblemShadow = await sharp(emblemPng)
    .modulate({ brightness: 0 })
    .blur(14)
    .ensureAlpha(0.65)
    .toBuffer();

  // 1. FULL-BLEED MASTER (512x512)
  console.log("Rendering smooth 512x512 background...");
  const bg512 = await createSmoothBackground(512, 512).png().toBuffer();

  const fullBleed512 = await sharp(bg512)
    .composite([
      { input: emblemShadow, top: topPos + 7, left: leftPos },
      { input: emblemPng, top: topPos, left: leftPos },
    ])
    .png()
    .toBuffer();

  // A. icon-maskable-512.png (Full bleed with safe zone for Android circle / squircle / pebble masks)
  const maskablePath = path.join(publicDir, "icon-maskable-512.png");
  fs.writeFileSync(maskablePath, fullBleed512);
  console.log("✓ Created", maskablePath);

  // B. apple-touch-icon.png (180x180 full bleed for iOS home screens)
  const applePath = path.join(publicDir, "apple-touch-icon.png");
  await sharp(fullBleed512)
    .resize(180, 180, { kernel: "lanczos3" })
    .png()
    .toFile(applePath);
  console.log("✓ Created", applePath);

  // 2. STANDALONE SQUIRCLE BADGE (For "any" purpose on Windows / macOS / Chrome / Android legacy)
  const squircleMaskSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect x="24" y="24" width="464" height="464" rx="108" ry="108" fill="#ffffff"/>
    </svg>
  `;
  const squircleMaskBuffer = await sharp(Buffer.from(squircleMaskSvg)).png().toBuffer();
  const maskedBg = await sharp(bg512)
    .composite([{ input: squircleMaskBuffer, blend: "dest-in" }])
    .png()
    .toBuffer();

  const rimBuffer = await sharp(Buffer.from(createSquircleRimSvg())).png().toBuffer();

  // Outer drop-shadow for the squircle container
  const shadowSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000000" flood-opacity="0.45"/>
        </filter>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="108" ry="108" fill="#0c0918" filter="url(#softShadow)"/>
    </svg>
  `;
  const shadowBuffer = await sharp(Buffer.from(shadowSvg)).png().toBuffer();

  const squircle512 = await sharp(shadowBuffer)
    .composite([
      { input: maskedBg },
      { input: rimBuffer },
      { input: emblemShadow, top: topPos + 7, left: leftPos },
      { input: emblemPng, top: topPos, left: leftPos },
    ])
    .png()
    .toBuffer();

  // C. icon-512.png (512x512 squircle badge)
  const icon512Path = path.join(publicDir, "icon-512.png");
  fs.writeFileSync(icon512Path, squircle512);
  console.log("✓ Created", icon512Path);

  // D. icon-192.png (192x192 squircle badge)
  const icon192Path = path.join(publicDir, "icon-192.png");
  await sharp(squircle512)
    .resize(192, 192, { kernel: "lanczos3" })
    .png()
    .toFile(icon192Path);
  console.log("✓ Created", icon192Path);

  // E. src/app/icon.png (Next.js favicon master)
  const faviconPath = path.join(appDir, "icon.png");
  fs.writeFileSync(faviconPath, squircle512);
  console.log("✓ Created", faviconPath);

  console.log("All premium PWA icons generated successfully!");
}

generateAllIcons().catch((err) => {
  console.error("Error generating PWA icons:", err);
  process.exit(1);
});
