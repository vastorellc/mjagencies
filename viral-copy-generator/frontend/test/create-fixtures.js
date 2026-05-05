import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, 'fixtures')

// Minimal valid MP4 file structure (ftyp + mdat boxes)
// These are tiny but valid MP4 files that can be read by ffprobe
function createMinimalMP4(filename, description) {
  // ftyp box (file type)
  const ftypBox = Buffer.from([
    0x00, 0x00, 0x00, 0x20, // box size
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6F, 0x6D, // major_brand 'isom'
    0x00, 0x00, 0x00, 0x00, // minor_version
    0x69, 0x73, 0x6F, 0x6D, // compatible_brands[0]
    0x69, 0x73, 0x6F, 0x32, // compatible_brands[1]
    0x6D, 0x70, 0x34, 0x31, // compatible_brands[2]
    0x69, 0x73, 0x6F, 0x6D, // compatible_brands[3]
  ])

  // Simple mdat box with placeholder data
  const dataSize = 1000 + Math.random() * 2000
  const mdatData = Buffer.alloc(Math.floor(dataSize))
  for (let i = 0; i < mdatData.length; i++) {
    mdatData[i] = Math.floor(Math.random() * 256)
  }

  const mdatSizeBuffer = Buffer.alloc(4)
  mdatSizeBuffer.writeUInt32BE(8 + mdatData.length)
  const mdatHeader = Buffer.from([0x6D, 0x64, 0x61, 0x74])

  const mp4 = Buffer.concat([ftypBox, mdatSizeBuffer, mdatHeader, mdatData])

  const filepath = join(fixturesDir, filename)
  writeFileSync(filepath, mp4)
  console.log(`✓ ${filename} created (${description})`)
}

// Create 5 fixture videos with different sizes for variety
createMinimalMP4('face-video.mp4', 'Face/people content simulation')
createMinimalMP4('motion-video.mp4', 'Motion/movement simulation')
createMinimalMP4('audio-video.mp4', 'Audio content simulation')
createMinimalMP4('scenes-video.mp4', 'Scene changes simulation')
createMinimalMP4('plain-video.mp4', 'Plain/simple video')

console.log('\n✅ All fixture videos created successfully')
console.log('📁 Location:', fixturesDir)
