import * as PIXI from "pixi.js";
import { App } from "../system/App";
import Matter from "matter-js";

export class Platform {
  container: PIXI.Container;
  sprites: PIXI.Sprite[];

  gridRect: PIXI.Rectangle;
  body!: Matter.Body;

  debugText = new PIXI.Text({
    text: "",
    style: {
      fontFamily: "Arial",
      fontSize: 100,
      fill: 0xffffff,
    },
    zIndex: 1000
  });

  cellDebugText: PIXI.Text[] = [];

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

    const cellDebugText = new PIXI.Text({
      text: `(${(gridRect.x + xIndex)}, ${(gridRect.y + yIndex)})`,
      style: {
        fontFamily: "Arial",
        fontSize: 8,
        fill: 0xffffff,
      },
      zIndex: 1000
    });
    cellDebugText.x = sprite.x + sprite.width / 2;
    cellDebugText.y = sprite.y + sprite.height / 2;
    cellDebugText.anchor.set(0.5, 0.5);
    this.cellDebugText.push(cellDebugText);
    this.container.addChild(cellDebugText);

    this.container.addChild(sprite);
    this.sprites.push(sprite);
  }


  createBody(gridRect: PIXI.Rectangle) {
    this.body = Matter.Bodies.rectangle(
      (gridRect.x + gridRect.width / 2) * App.config.tileSize,
      (gridRect.y + gridRect.height / 2) * App.config.tileSize,
      gridRect.width * App.config.tileSize,
      gridRect.height * App.config.tileSize,
      {
        isStatic: true,
        friction: 0,
      });
    Matter.World.add(App.physics.world, this.body);
  }

  // move(vector: PIXI.Point) {
  //   this.body.position.x -= vector.x;
  //   this.body.position.y -= vector.y;
  // }

  update() {
    this.sprites.forEach((sprite, index) => {
      const xIndex = index % this.gridRect.width;
      const yIndex = Math.floor(index / this.gridRect.width);

      sprite.x = this.body.position.x - (this.gridRect.width / 2) * App.config.tileSize + xIndex * App.config.tileSize;
      sprite.y = this.body.position.y - (this.gridRect.height / 2) * App.config.tileSize + yIndex * App.config.tileSize;
    });

    this.debugText.text = `${this.body.position.x.toFixed(2)}\n${this.body.position.y.toFixed(2)}`;
  }

  destroy() {
    Matter.World.remove(App.physics.world, this.body);
    this.container.destroy({ children: true });
  }
}
