// Renders the app icons from the team logo (public/falcon.png). Run: node scripts/icons.mjs
// For sharper install icons, replace public/falcon.png with a larger copy (500px+) and rerun.
import sharp from 'sharp'

const SRC = 'public/falcon.png'
const GREEN = { r: 0, g: 64, b: 42, alpha: 1 } // --green-deep

async function icon(dest, size, frac, background) {
  const inner = Math.round(size * frac)
  const logo = await sharp(SRC)
    .resize(inner, inner, { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .sharpen({ sigma: 0.6 })
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(dest)
  console.log('wrote', dest)
}

await icon('public/pwa-192.png', 192, 0.8, GREEN)
await icon('public/pwa-512.png', 512, 0.8, GREEN)
await icon('public/maskable-512.png', 512, 0.6, GREEN) // stays inside Android's round/squircle crop
await icon('public/apple-touch-icon.png', 180, 0.8, GREEN) // iOS needs an opaque icon
await icon('public/favicon-32.png', 32, 1, { r: 0, g: 0, b: 0, alpha: 0 })
