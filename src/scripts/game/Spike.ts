import * as PIXI from "pixi.js";
import { App } from "../system/App";
import Matter from "matter-js";

export class Spike {
  container: PIXI.Container;
  sprite!: PIXI.Sprite;
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

  constructor(point: PIXI.Point) {
    this.container = new PIXI.Container();
    this.createSprite(point);
    this.createBody(point);
    this.sprite.position = this.body.position;
  }

  createSprite(point: PIXI.Point) {
    this.sprite = App.sprite("spikes");
    this.sprite.setSize(App.config.tileSize);
    this.container.addChild(this.sprite);
  }

  createBody(point: PIXI.Point) {
    this.body = Matter.Bodies.rectangle(
      point.x * App.config.tileSize,
      point.y * App.config.tileSize,
      App.config.tileSize,
      App.config.tileSize,
      {
        isStatic: true,
        isSensor: true,
        friction: 0
      });

    Matter.World.add(App.physics.world, this.body);
  }

  // move(vector: PIXI.Point) {
  //   this.body.position.x -= vector.x;
  //   this.body.position.y -= vector.y;
  // }

  update() {
    this.sprite.position = this.body.position;
    this.debugText.text = `${this.body.position.x.toFixed(2)}\n${this.body.position.y.toFixed(2)}`;
  }

  destroy() {
    Matter.World.remove(App.physics.world, this.body);
    this.container.destroy({ children: true });
  }
}
