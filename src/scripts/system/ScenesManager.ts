import * as PIXI from "pixi.js";
import { App } from "./App";
import { Scene } from "./Scene";
import { SceneName } from "../game/Config";

export class ScenesManager {
  container: PIXI.Container;
  scene: Scene | null;

  constructor() {
    this.container = new PIXI.Container();
    this.container.interactive = true;
    this.scene = null;
  }

  start(sceneName: SceneName) {
    if (this.scene) {
      this.scene.remove();
    }

    this.scene = new App.config.scenes[sceneName]();
    if (this.scene) {
      this.container.addChild(this.scene.container);
    }
  }
}
