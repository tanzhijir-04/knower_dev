const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const ASSETS_DIR = path.join(__dirname, '..', 'assets')

/**
 * Generate an Apple-style squircle (superellipse n=5) SVG mask.
 * White filled shape on transparent background — used with
 * sharp composite 'dest-in' to cut transparent corners.
 */
function squircleMaskSvg(size) {
  const cx = size / 2, cy = size / 2, r = size / 2
  const n = 5 // Apple superellipse exponent
  const steps = 120
  const points = []

  for (let i = 0; i <= steps; i++) {
    const t = (Math.PI * 2 * i) / steps
    const cosT = Math.cos(t), sinT = Math.sin(t)
    const x = cx + r * Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n)
    const y = cy + r * Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <polygon points="${points.join(' ')}" fill="white"/>
  </svg>`
}

/**
 * Render icon SVG → PNG with squircle-masked transparent corners.
 */
async function renderIcon(size) {
  const colorSvg = fs.readFileSync(path.join(ASSETS_DIR, 'logo-color.svg'))
  const maskSvg = squircleMaskSvg(size)

  const iconBuf = await sharp(colorSvg).resize(size, size).png().toBuffer()
  const maskBuf = await sharp(Buffer.from(maskSvg)).resize(size, size).png().toBuffer()

  return sharp(iconBuf)
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function convert() {
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

  for (const size of sizes) {
    const buf = await renderIcon(size)
    await sharp(buf).toFile(path.join(ASSETS_DIR, `icon-${size}x${size}.png`))
    console.log(`Created icon-${size}x${size}.png`)
  }

  // Create ICO file for Windows (16, 32, 48, 256)
  const icoSizes = [16, 32, 48, 256]
  const icoBuffers = []
  for (const size of icoSizes) {
    const buf = await renderIcon(size)
    icoBuffers.push({ size, buf })
  }

  const ico = buildICO(icoBuffers)
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), ico)
  console.log('Created icon.ico')

  // Create ICNS for macOS (512 and 1024)
  const png512 = await renderIcon(512)
  const png1024 = await renderIcon(1024)
  const icns = buildICNS([
    { type: 'ic07', buf: png512 },
    { type: 'ic08', buf: png1024 },
  ])
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.icns'), icns)
  console.log('Created icon.icns')
}

function buildICO(images) {
  const entries = []
  let dataOffset = 6 + images.length * 16

  for (const img of images) {
    entries.push({
      width: img.size >= 256 ? 0 : img.size,
      height: img.size >= 256 ? 0 : img.size,
      bpp: 32,
      dataOffset,
      buf: img.buf,
    })
    dataOffset += img.buf.length
  }

  // ICO header
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)     // reserved
  header.writeUInt16LE(1, 2)     // type: ICO
  header.writeUInt16LE(images.length, 4) // count

  // Directory entries
  const dirEntries = Buffer.alloc(entries.length * 16)
  entries.forEach((entry, i) => {
    const offset = i * 16
    dirEntries.writeUInt8(entry.width, offset)
    dirEntries.writeUInt8(entry.height, offset + 1)
    dirEntries.writeUInt8(0, offset + 2)      // palette
    dirEntries.writeUInt8(0, offset + 3)      // reserved
    dirEntries.writeUInt16LE(1, offset + 4)   // color planes
    dirEntries.writeUInt16LE(32, offset + 6)  // bits per pixel
    dirEntries.writeUInt32LE(entry.buf.length, offset + 8)  // data size
    dirEntries.writeUInt32LE(entry.dataOffset, offset + 12) // data offset
  })

  return Buffer.concat([header, dirEntries, ...entries.map(e => e.buf)])
}

function buildICNS(images) {
  let totalSize = 8 // header
  const entries = []

  for (const img of images) {
    const entrySize = 8 + img.buf.length
    entries.push({ type: img.type, buf: img.buf, size: entrySize })
    totalSize += entrySize
  }

  const header = Buffer.alloc(8)
  header.write('icns', 0)
  header.writeUInt32BE(totalSize, 4)

  const entryBuffers = entries.map(entry => {
    const buf = Buffer.alloc(8)
    buf.write(entry.type, 0)
    buf.writeUInt32BE(entry.size, 4)
    return Buffer.concat([buf, entry.buf])
  })

  return Buffer.concat([header, ...entryBuffers])
}

convert().catch(console.error)
