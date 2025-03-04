import * as PIXI from "pixi.js";
import { App } from "../system/App";
import Matter from "matter-js";

export class Player {
  container: PIXI.Container;
  sprite!: PIXI.Sprite;

  body!: Matter.Body;
  moving: boolean = false;
  canJump: boolean = false;

  get velocity() {
    return this.body.velocity;
  }

  constructor(startPosition: PIXI.Point) {
    this.container = new PIXI.Container();
    this.createSprite(startPosition);
    this.createBody();
  }

  createSprite(startPosition: PIXI.Point) {
    this.sprite = App.sprite("player");
    this.sprite.position = new PIXI.Point(
      (startPosition.x - 0.5) * App.config.tileSize,
      (startPosition.y - 0.5) * App.config.tileSize);
    this.sprite.setSize(App.config.tileSize);
    this.container.addChild(this.sprite);

    // this is the only sprite with anchor in the center of mass
    this.sprite.anchor.set(0.5, 0.5);
  }

  createBody() {
    this.body = Matter.Bodies.rectangle(
      this.sprite.x,
      this.sprite.y,
      this.sprite.width,
      this.sprite.height,
      {
        restitution: 0.1,
      });

    Matter.World.add(App.physics.world, this.body);
  }

  move(xDir: number) {
    Matter.Body.applyForce(this.body, this.body.position, {
      x: xDir * App.config.playerSpeed,
      y: 0
    });

    this.moving = true;
  }

  jump() {
    if (this.canJump) {
      Matter.Body.applyForce(this.body, this.body.position, {
        x: 0,
        y: -App.config.playerJump
      });
      this.canJump = false;
      this.sprite.texture = App.res("playerJumping");

      if (this.body.angularSpeed < 0.075)
        Matter.Body.setAngularVelocity(this.body, 0.075 * Math.sign(this.body.velocity.x));
    }
  }

  land() {
    this.canJump = true;
    this.sprite.texture = App.sprite("player").texture;
  }

  leftBound() {
    return this.sprite.x + this.sprite.width / 2 > window.innerWidth * (0.5 + App.config.playerBoundPercentage * 0.5) &&
      this.velocity.x > 0;
  }

  rightBound() {
    return this.sprite.x < window.innerWidth * (0.5 - App.config.playerBoundPercentage * 0.5) &&
      this.velocity.x < 0;
  }

  bottomBound() {
    return this.sprite.y + this.sprite.height > window.innerHeight * (0.5 + App.config.playerBoundPercentage * 0.5) &&
      this.velocity.y > 0;
  }

  topBound() {
    return this.sprite.y < window.innerHeight * (0.5 - App.config.playerBoundPercentage * 0.5) &&
      this.velocity.y < 0;
  }

  update() {
    this.sprite.position = this.body.position;
    this.sprite.rotation = this.body.angle;
  }
}
