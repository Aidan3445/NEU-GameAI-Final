import * as PIXI from "pixi.js";
import { App } from "../system/App";
import Matter from "matter-js";

export class Platform {
  container: PIXI.Container;
  sprites: PIXI.Sprite[];

  gridRect: PIXI.Rectangle;
  body!: Matter.Body;

  constructor(gridRect: PIXI.Rectangle) {
    this.container = new PIXI.Container();
    this.sprites = [];
    this.gridRect = gridRect;

    this.createSprites(gridRect);
    this.createBody(gridRect);
  }

  createSprites(gridRect: PIXI.Rectangle) {
    this.sprites = [];

    for (let i = 0; i < gridRect.width * gridRect.height; i++) {
      this.createSprite(i, gridRect);
    }
  }

  createSprite(i: number, gridRect: PIXI.Rectangle) {
    const sprite = App.sprite("platform");

    const xIndex = i % gridRect.width;
    const yIndex = Math.floor(i / gridRect.width);

    sprite.x = (gridRect.x + xIndex) * App.config.tileSize;
    sprite.y = (gridRect.y + yIndex) * App.config.tileSize;
    sprite.setSize(App.config.tileSize);
    this.container.addChild(sprite);
    this.sprites.push(sprite);
  }


  createBody(gridRect: PIXI.Rectangle) {
    this.body = Matter.Bodies.rectangle(
      (gridRect.x + gridRect.width / 2) * App.config.tileSize,
      (gridRect.y + gridRect.height / 2) * App.config.tileSize,
      gridRect.width * App.config.tileSize,
      gridRect.height * App.config.tileSize,
      { isStatic: true });
    Matter.World.add(App.physics.world, this.body);
  }

  move(vector: PIXI.Point) {
    this.body.position.x -= vector.x;
    this.body.position.y -= vector.y;
  }

  update() {
    this.sprites.forEach((sprite, index) => {
      const xIndex = index % this.gridRect.width;
      const yIndex = Math.floor(index / this.gridRect.width);

      sprite.x = this.body.position.x - (this.gridRect.width / 2) * App.config.tileSize + xIndex * App.config.tileSize;
      sprite.y = this.body.position.y - (this.gridRect.height / 2) * App.config.tileSize + yIndex * App.config.tileSize;
    });
  }
}
