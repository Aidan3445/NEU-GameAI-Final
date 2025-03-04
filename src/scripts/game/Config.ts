import * as PIXI from "pixi.js";
import { Tools } from "../system/Tools";
import { GameScene } from "./GameScene";
import { Game } from "./Game";
import { Scene } from "../system/Scene";

export type SceneName = 'Game' | 'StartScene';

export class Config {
  static loader = Tools.importAll(require.context('./../../sprites', true, /\.(png|mp3)$/));
  static scenes: Record<SceneName, typeof Scene> = {
    "Game": GameScene,
    "StartScene": Game
  }
  static stage: PIXI.Container;
  // tiles in pixels
  static tileSize = 64;
  // how close to the edge of the screen the player can go
  static playerBoundPercentage = 0.8;

  static playerSpeed = 0.1;
  static playerMaxSpeed = 0.5;
  static playerJump = 0.155;
}

