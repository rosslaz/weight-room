// Renders the PNG app icons from the SVGs in /public. Run: node scripts/icons.mjs
import sharp from 'sharp'
const out = [
  ['public/icon.svg', 'public/pwa-192.png', 192],
  ['public/icon.svg', 'public/pwa-512.png', 512],
  ['public/maskable.svg', 'public/maskable-512.png', 512],
  ['public/maskable.svg', 'public/apple-touch-icon.png', 180],
  ['public/icon.svg', 'public/favicon-32.png', 32],
]
for (const [src, dest, size] of out) {
  await sharp(src, { density: 384 }).resize(size, size).png().toFile(dest)
  console.log('wrote', dest)
}
