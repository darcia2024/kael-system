import path from "node:path";
import sharp from "sharp";

const root = "C:/Users/ASUS/OneDrive/Documents/KAEL System/web";
const sourceLogo = path.join(root, "public", "kael-logo.png");
const publicDir = path.join(root, "public");

async function generateIcons() {
  console.log("Generating PWA icons from:", sourceLogo);

  // 1. icon-192.png (192x192)
  await sharp(sourceLogo)
    .resize(192, 192, { fit: "contain", background: { r: 15, g: 23, b: 42, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, "icon-192.png"));
  console.log("Created icon-192.png");

  // 2. icon-512.png (512x512)
  await sharp(sourceLogo)
    .resize(512, 512, { fit: "contain", background: { r: 15, g: 23, b: 42, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, "icon-512.png"));
  console.log("Created icon-512.png");

  // 3. icon-maskable-512.png (512x512 with safe area margin for Android circle / squircle icon masks)
  const innerSize = Math.round(512 * 0.76); // ~390px inner icon
  const innerBuffer = await sharp(sourceLogo)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 22, g: 74, b: 57, alpha: 1 }, // #164A39 Mochi Dark Green
    },
  })
    .composite([{ input: innerBuffer, gravity: "center" }])
    .png()
    .toFile(path.join(publicDir, "icon-maskable-512.png"));
  console.log("Created icon-maskable-512.png");

  // 4. apple-touch-icon.png (180x180)
  const appleInnerSize = Math.round(180 * 0.8);
  const appleInnerBuffer = await sharp(sourceLogo)
    .resize(appleInnerSize, appleInnerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 22, g: 74, b: 57, alpha: 1 },
    },
  })
    .composite([{ input: appleInnerBuffer, gravity: "center" }])
    .png()
    .toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("Created apple-touch-icon.png");

  console.log("All PWA icons generated successfully!");
}

generateIcons().catch((err) => {
  console.error("Error generating PWA icons:", err);
  process.exit(1);
});
