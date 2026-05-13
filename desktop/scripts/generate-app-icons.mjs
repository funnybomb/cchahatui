import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(scriptDir, '..')
const tauriIconDir = path.join(desktopDir, 'src-tauri', 'icons')
const publicDir = path.join(desktopDir, 'public')
const sourceSvg = path.join(publicDir, 'app-icon.svg')
const tmpDir = path.join(desktopDir, '.icon-tmp')

if (!existsSync(sourceSvg)) {
  throw new Error(`Missing icon source: ${sourceSvg}`)
}

rmSync(tmpDir, { recursive: true, force: true })
mkdirSync(tmpDir, { recursive: true })

const masterPng = path.join(tmpDir, 'app-icon-1024.png')
execFileSync('sips', ['-s', 'format', 'png', sourceSvg, '--out', masterPng], { stdio: 'inherit' })

function resize(size, out) {
  mkdirSync(path.dirname(out), { recursive: true })
  execFileSync('sips', ['-z', String(size), String(size), masterPng, '--out', out], { stdio: 'ignore' })
}

resize(1024, path.join(publicDir, 'app-icon.png'))
resize(512, path.join(tauriIconDir, 'icon.png'))
resize(32, path.join(tauriIconDir, '32x32.png'))
resize(64, path.join(tauriIconDir, '64x64.png'))
resize(128, path.join(tauriIconDir, '128x128.png'))
resize(256, path.join(tauriIconDir, '128x128@2x.png'))

const windowsIcons = [
  ['Square30x30Logo.png', 30],
  ['Square44x44Logo.png', 44],
  ['StoreLogo.png', 50],
  ['Square71x71Logo.png', 71],
  ['Square89x89Logo.png', 89],
  ['Square107x107Logo.png', 107],
  ['Square142x142Logo.png', 142],
  ['Square150x150Logo.png', 150],
  ['Square284x284Logo.png', 284],
  ['Square310x310Logo.png', 310],
]

for (const [file, size] of windowsIcons) {
  resize(size, path.join(tauriIconDir, file))
}

const iosIcons = [
  ['AppIcon-20x20@1x.png', 20],
  ['AppIcon-20x20@2x-1.png', 40],
  ['AppIcon-20x20@2x.png', 40],
  ['AppIcon-20x20@3x.png', 60],
  ['AppIcon-29x29@1x.png', 29],
  ['AppIcon-29x29@2x-1.png', 58],
  ['AppIcon-29x29@2x.png', 58],
  ['AppIcon-29x29@3x.png', 87],
  ['AppIcon-40x40@1x.png', 40],
  ['AppIcon-40x40@2x-1.png', 80],
  ['AppIcon-40x40@2x.png', 80],
  ['AppIcon-40x40@3x.png', 120],
  ['AppIcon-512@2x.png', 1024],
  ['AppIcon-60x60@2x.png', 120],
  ['AppIcon-60x60@3x.png', 180],
  ['AppIcon-76x76@1x.png', 76],
  ['AppIcon-76x76@2x.png', 152],
  ['AppIcon-83.5x83.5@2x.png', 167],
]

for (const [file, size] of iosIcons) {
  resize(size, path.join(tauriIconDir, 'ios', file))
}

const androidIcons = [
  ['mipmap-mdpi/ic_launcher.png', 48],
  ['mipmap-mdpi/ic_launcher_round.png', 48],
  ['mipmap-mdpi/ic_launcher_foreground.png', 108],
  ['mipmap-hdpi/ic_launcher.png', 72],
  ['mipmap-hdpi/ic_launcher_round.png', 72],
  ['mipmap-hdpi/ic_launcher_foreground.png', 162],
  ['mipmap-xhdpi/ic_launcher.png', 96],
  ['mipmap-xhdpi/ic_launcher_round.png', 96],
  ['mipmap-xhdpi/ic_launcher_foreground.png', 216],
  ['mipmap-xxhdpi/ic_launcher.png', 144],
  ['mipmap-xxhdpi/ic_launcher_round.png', 144],
  ['mipmap-xxhdpi/ic_launcher_foreground.png', 324],
  ['mipmap-xxxhdpi/ic_launcher.png', 192],
  ['mipmap-xxxhdpi/ic_launcher_round.png', 192],
  ['mipmap-xxxhdpi/ic_launcher_foreground.png', 432],
]

for (const [file, size] of androidIcons) {
  resize(size, path.join(tauriIconDir, 'android', file))
}

const iconsetDir = path.join(tmpDir, 'icon.iconset')
mkdirSync(iconsetDir, { recursive: true })
for (const [file, size] of [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]) {
  resize(size, path.join(iconsetDir, file))
}
execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(tauriIconDir, 'icon.icns')], {
  stdio: 'inherit',
})

const icoSizes = [16, 32, 64, 128, 256]
const icoImages = icoSizes.map((size) => {
  const file = path.join(tmpDir, `ico-${size}.png`)
  resize(size, file)
  return { size, bytes: readFileSync(file) }
})

const headerSize = 6
const entrySize = 16
let imageOffset = headerSize + entrySize * icoImages.length
const header = Buffer.alloc(imageOffset)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(icoImages.length, 4)

for (let index = 0; index < icoImages.length; index += 1) {
  const { size, bytes } = icoImages[index]
  const entryOffset = headerSize + index * entrySize
  header.writeUInt8(size === 256 ? 0 : size, entryOffset)
  header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1)
  header.writeUInt8(0, entryOffset + 2)
  header.writeUInt8(0, entryOffset + 3)
  header.writeUInt16LE(1, entryOffset + 4)
  header.writeUInt16LE(32, entryOffset + 6)
  header.writeUInt32LE(bytes.length, entryOffset + 8)
  header.writeUInt32LE(imageOffset, entryOffset + 12)
  imageOffset += bytes.length
}

writeFileSync(path.join(tauriIconDir, 'icon.ico'), Buffer.concat([header, ...icoImages.map(({ bytes }) => bytes)]))
rmSync(tmpDir, { recursive: true, force: true })

console.log('Generated cchahatui app icons.')
