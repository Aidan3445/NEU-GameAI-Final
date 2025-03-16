import * as PIXI from "pixi.js";
import { Tools } from "../system/Tools";
import { GameScene } from "./GameScene";
import { Scene } from "../system/Scene";

export type SceneName = 'Game';

export class Config {
  static loader = Tools.importAll(require.context('./../../sprites', true, /\.(png|mp3)$/));
  static scenes: Record<SceneName, typeof Scene> = {
    "Game": GameScene,
  }
  static stage: PIXI.Container;
  // tiles in pixels
  static tileSize = 32;
  static playerScale = 0.8;
  static playerSpeed = 0.75;
  static playerJump = 1.75;
  static playerMaxSpeed = 1;
  static playerMaxFallSpeed = 20;
}

