import fs from 'fs'

const releaseDir = 'release'
if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true })
  console.log('release folder cleaned')
} else {
  console.log('release folder not exists')
}
