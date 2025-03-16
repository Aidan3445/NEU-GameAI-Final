import * as PIXI from "pixi.js";
import Matter from "matter-js";
import { Loader } from "./Loader"
import { ScenesManager } from "./ScenesManager";
import { Config } from "../game/Config";

class Application {
  app!: PIXI.Application
  config!: typeof Config;
  loader!: Loader;
  scenes!: ScenesManager;
  physics!: Matter.Engine;

  controllerInput: {
    left: boolean;
    right: boolean;
    jump: boolean;
    drop: boolean;
  } = {
      left: false,
      right: false,
      jump: false,
      drop: false,
    };

  run(config: typeof Config) {
    this.config = config;
    this.app = new PIXI.Application();
    this.config.stage = this.app.stage;
    this.app.init({ width: window.innerWidth, height: window.innerHeight }).then(() => {
      document.body.appendChild(this.app.canvas);
      this.loader = new Loader(this.config);
      this.loader.preload().then(() => this.start());
    })

    this.createPhysics();
  }

  start() {
    this.scenes = new ScenesManager();
    if (!this.app || !this.scenes) {
      throw new Error("Application or ScenesManager not initialized");
    }
    this.app.stage.addChild(this.scenes.container)
    this.scenes.start("Game");
  }

  createPhysics() {
    this.physics = Matter.Engine.create();
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, this.physics);
  }

  res(key: string) {
    if (!this.loader) {
      throw new Error("Loader not initialized");
    }
    return this.loader.resources[key];
  }

  sprite(key: string) {
    return new PIXI.Sprite(this.res(key));
  }
}

export const App = new Application();
