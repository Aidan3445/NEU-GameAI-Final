import * as PIXI from "pixi.js";
import { App } from "../system/App";
import Matter from "matter-js";

export class Player {
  container: PIXI.Container;
  sprite!: PIXI.Sprite;

  body!: Matter.Body;
  moving: boolean = false;
  canJump: boolean = false;
  jumpCooldown: boolean = false;

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
        mass: 50,
        inertia: Infinity,
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
    if (this.canJump && !this.jumpCooldown) {
      Matter.Body.setVelocity(this.body, {
        x: this.body.velocity.x,
        y: 0
      });
      Matter.Body.applyForce(this.body, this.body.position, {
        x: 0,
        y: -App.config.playerJump
      });
      this.canJump = false;
      this.sprite.texture = App.res("playerJumping");

      this.jumpCooldown = true;
      setTimeout(() => this.jumpCooldown = false, 500);
    }
  }

  land() {
    this.canJump = true;
    this.sprite.texture = App.sprite("player").texture;
  }

  update() {
    this.sprite.position = this.body.position;
    this.sprite.rotation = this.body.angle;
  }
}
