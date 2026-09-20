import './ui/styles.css'
import { Game } from './core/Game'

const canvas = document.getElementById('viewport')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing #viewport canvas')

new Game(canvas).start()
