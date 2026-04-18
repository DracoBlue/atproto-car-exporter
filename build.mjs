import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'fs'

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
})

const js = result.outputFiles[0].text
const template = readFileSync('src/template.html', 'utf8')
const html = template.replace('  <!-- BUNDLE -->', () => `  <script>${js}</script>`)
writeFileSync('index.html', html)
console.log('Built index.html (' + (html.length / 1024).toFixed(1) + ' KB)')
