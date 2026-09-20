// Packages a built dist/ into the three flat files the Artifact host serves: index.html,
// game.js, game.css. The app shell is index.html, so the artifact stays in step with the
// game automatically instead of being hand-edited every time the HUD grows an element.
//
//   node scripts/artifact.mjs <out-dir>
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
if (!out) throw new Error('usage: node scripts/artifact.mjs <out-dir>')
mkdirSync(out, { recursive: true })

const assets = readdirSync('dist/assets')
const js = assets.find((name) => name.endsWith('.js'))
const css = assets.find((name) => name.endsWith('.css'))
if (!js || !css) throw new Error('dist/assets is missing a built js/css pair — run vite build first')

copyFileSync(join('dist/assets', js), join(out, 'game.js'))
copyFileSync(join('dist/assets', css), join(out, 'game.css'))

// The host wraps the fragment in its own document, so hand it markup without html/head/body.
const shell = readFileSync('index.html', 'utf8')
const title = shell.slice(shell.indexOf('<title>'), shell.indexOf('</title>') + 8)
const body = shell.slice(shell.indexOf('<body>') + 6, shell.indexOf('</body>'))

writeFileSync(
  join(out, 'index.html'),
  `${title}\n\n<link rel="stylesheet" href="game.css" />\n${body.trimEnd().replace('src="/src/main.ts"', 'src="game.js"')}\n`,
)
console.log(`packaged ${out}: game.js (${js}), game.css (${css})`)
