import * as PIXI from "pixi.js";
import { App } from "../system/App";

export class Background {
  container: PIXI.Container;
  sprites: PIXI.Sprite[];

  constructor() {
    this.container = new PIXI.Container();
    this.sprites = [];

    this.createSprites();
  }

  createSprites() {
    this.sprites = [];

    for (let i = 0; i < 9; i++) {
      this.createSprite(i);
    }
  }

  createSprite(i: number) {
    const sprite = App.sprite("bg");

    const xIndex = i % 3;
    const yIndex = Math.floor(i / 3);

    sprite.x = sprite.width * xIndex;
    sprite.y = sprite.height * yIndex;
    this.container.addChild(sprite);
    this.sprites.push(sprite);
  }

  move(vector: PIXI.Point) {
    this.sprites.forEach((sprite) => {
      // conveyor belt effect for the background
      if (vector.x > 0 && sprite.x + sprite.width < 0) {
        sprite.x += 3 * sprite.width;
      } else if (vector.x < 0 && sprite.x > window.innerWidth) {
        sprite.x -= 3 * sprite.width;
      }
      if (vector.y > 0 && sprite.y + sprite.height < 0) {
        sprite.y += 3 * sprite.height;
      } else if (vector.y < 0 && sprite.y > window.innerHeight) {
        sprite.y -= 3 * sprite.height;
      }

      sprite.y -= vector.y;
      sprite.x -= vector.x;
    });
  }
}
