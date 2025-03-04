import * as PIXI from "pixi.js";
import { App } from "./App";

export class Scene {
  container: PIXI.Container;
  sprites: PIXI.Sprite[];

  constructor() {
    this.container = new PIXI.Container();
    this.container.interactive = true;

    this.sprites = [];

    this.create();

    if (App.app) {
      App.app.stage.addChild(this.container);
      App.app.ticker.add(this.update, this);
    }
  }

  create() {
  }

  update(_dt: PIXI.Ticker) {
  }

  destroy() {
  }

  remove() {
    if (App.app) {
      App.app.ticker.remove(this.update, this);
      this.destroy();
      this.container.destroy();
    }
  }
}
