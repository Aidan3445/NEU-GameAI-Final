import * as PIXI from 'pixi.js'
const Application = PIXI.Application

const app = new Application();

await app.init({ width: 500, height: 500 });

console.log(app.renderer)
document.body.append(app.canvas)
