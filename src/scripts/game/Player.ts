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

  contacts: Matter.Vector[] = [];

  debugText: PIXI.Text;

  get velocity() {
    return this.body.velocity;
  }

  constructor(startPosition: PIXI.Point) {
    this.container = new PIXI.Container();
    this.createSprite(startPosition);
    this.createBody();

    this.debugText = new PIXI.Text({
      text: "0",
      style: {
        fontFamily: "Arial",
        fontSize: 204,
        fill: 0xffffff,
      }
    });
    this.sprite.addChild(this.debugText);
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
        inertia: Infinity
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
        x: this.velocity.x,
        y: 0
      });

      const wallJump = this.contacts.reduce((acc, normal) => {
        return acc + normal.x;
      }, 0);

      Matter.Body.applyForce(this.body, this.body.position, {
        x: wallJump * App.config.playerSpeed * 0.5,
        y: -App.config.playerJump
      });
      this.canJump = false;
      this.sprite.texture = App.res("playerJumping");

      this.jumpCooldown = true;
      setTimeout(() => this.jumpCooldown = false, 500);
    }
  }

  land(normal: Matter.Vector) {
    this.canJump = true;
    this.sprite.texture = App.sprite("player").texture;
    this.contacts.push(normal);
    Matter.Body.setVelocity(this.body, {
      x: 0,
      y: this.velocity.y
    });
  }

  falling(normal: Matter.Vector) {
    const toRemoveIndex = this.contacts.findIndex((n) => n.x === normal.x && n.y === normal.y);
    this.contacts = this.contacts.filter((_, index) => index !== toRemoveIndex);

    if (this.contacts.length === 0) {
      this.canJump = false;
      this.sprite.texture = App.res("playerJumping");
    }
  }

  update() {
    this.sprite.position = this.body.position;
    this.sprite.rotation = this.body.angle;

    this.debugText.text = `${this.velocity.x.toFixed(2)}\n${this.velocity.y.toFixed(2)}`;
  }
}
