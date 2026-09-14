import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourceLogo = path.join(root, "public", "logo-mochi.png");
const publicDir = path.join(root, "public");
const appDir = path.join(root, "src", "app");

/**
 * Creates an ultra-premium Deep Forest Emerald (#0b3d2e) background with subtle
 * radial gradient and dither to prevent banding.
 */
function createMochiBackground(w = 512, h = 512) {
  const raw = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const tY = y / h;

      // Base gradient: top rich emerald (#0e4635) to bottom deep forest (#07261d)
      let r = 14 * (1 - tY) + 7 * tY;
      let g = 70 * (1 - tY) + 38 * tY;
      let b = 53 * (1 - tY) + 29 * tY;

      // Soft ambient glow around center (cx=256, cy=256)
      const dC = Math.hypot(x - 256, y - 256) / 240;
      if (dC < 1) {
        const factor = Math.cos(dC * Math.PI * 0.5) * 0.22;
        r += 18 * factor;
        g += 90 * factor;
        b += 65 * factor;
      }

      // Neon lime ambient accent hint at top right (x=400, y=100)
      const dL = Math.hypot(x - 400, y - 100) / 160;
      if (dL < 1) {
        const factor = Math.cos(dL * Math.PI * 0.5) * 0.15;
        r += 200 * factor;
        g += 245 * factor;
        b += 58 * factor;
      }

      // Triangular dither noise
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
        <linearGradient id="mochiRim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#c8f53a" stop-opacity="0.45"/>
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#0b3d2e" stop-opacity="0.10"/>
        </linearGradient>
      </defs>
      <rect x="20" y="20" width="472" height="472" rx="112" ry="112" stroke="url(#mochiRim)" stroke-width="2" fill="none"/>
    </svg>
  `;
}

async function run() {
  console.log("Generating Mochi PWA icons from:", sourceLogo);
  const bg = await createMochiBackground(512, 512).png().toBuffer();

  // For 512 canvas, safe zone circle has radius 205 (diameter 410).
  // Let's place the circular badge emblem at 370x370.
  const emblemDim = 370;
  const emblemOffset = Math.round((512 - emblemDim) / 2); // 71

  const emblemPng = await sharp(sourceLogo)
    .resize(emblemDim, emblemDim, { fit: "contain" })
    .toBuffer();

  const rimSvg = Buffer.from(createSquircleRimSvg());

  // Full-bleed 512x512 with Mochi background & emblem (for maskable icon)
  const fullBleed512 = await sharp(bg)
    .composite([
      { input: emblemPng, top: emblemOffset, left: emblemOffset },
    ])
    .png()
    .toBuffer();

  // With subtle squircle rim for standard home screen launcher & apple touch icon
  const squircleRim512 = await sharp(fullBleed512)
    .composite([{ input: rimSvg, top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Generate targets:
  fs.writeFileSync(path.join(publicDir, "icon-maskable-512.png"), fullBleed512);
  fs.writeFileSync(path.join(publicDir, "icon-512.png"), fullBleed512);

  // 192x192
  const icon192 = await sharp(fullBleed512).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, "icon-192.png"), icon192);

  // apple-touch-icon 180x180
  const appleTouch = await sharp(squircleRim512).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), appleTouch);

  // src/app/icon.png (used by Next.js for favicon / app tab icon, 96x96 or 192x192)
  const appIcon = await sharp(fullBleed512).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(appDir, "icon.png"), appIcon);

  console.log("All Mochi PWA icons & app icons successfully generated!");
}

run().catch(console.error);
