import * as PIXI from "pixi.js";
import { App } from "../system/App";
import { Scene } from "../system/Scene";

export class Game extends Scene {
  bg: PIXI.Sprite | null;
  backgroundSprite: PIXI.Sprite | null;

  constructor() {
    super()
    this.container = new PIXI.Container();
    this.bg = null;
    this.backgroundSprite = null;

    this.createBackground();
  }

  createBackground() {
    this.bg = App.sprite("bg");

    this.backgroundSprite = this.bg;

    this.backgroundSprite.width = window.innerWidth
    this.backgroundSprite.height = window.innerHeight

    this.container.addChild(this.backgroundSprite);
  }
}
