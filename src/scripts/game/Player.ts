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

  backgroundContainer: PIXI.Container;

  leftParabola: PIXI.Graphics = new PIXI.Graphics();
  rightParabola: PIXI.Graphics = new PIXI.Graphics();
  centerTop: PIXI.Graphics = new PIXI.Graphics();

  debugText = new PIXI.Text({
    text: "",
    style: {
      fontFamily: "Arial",
      fontSize: 204,
      fill: 0xffffff,
    },
    zIndex: 1000
  });

  get velocity() {
    return this.body.velocity;
  }

  constructor(backgroundContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    this.createSprite();
    this.createBody();

    this.sprite.addChild(this.debugText);

    this.backgroundContainer = backgroundContainer;
  }

  createSprite() {
    this.sprite = App.sprite("player");
    this.sprite.position = new PIXI.Point(0, 0);
    this.sprite.setSize(App.config.tileSize * App.config.playerScale);
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
        friction: 0.05,
        frictionAir: 0,
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

      const wallJump = 0;
      /*
        this.contacts.reduce((acc, normal) => {
        return acc + normal.x;
      }, 0);
      */

      Matter.Body.applyForce(this.body, this.body.position, {
        x: wallJump * App.config.playerSpeed * 0.5,
        y: -App.config.playerJump
      });
      this.canJump = false;
      this.sprite.texture = App.res("playerJumping");

      this.jumpCooldown = true;
      setTimeout(() => this.jumpCooldown = false, 500);

      // draw parabola of jumps to the left
      this.leftParabola = new PIXI.Graphics();
      this.leftParabola.moveTo(this.body.position.x, this.body.position.y);
      for (let x = 0; x < 1000; x++) {
        this.leftParabola.lineTo(this.body.position.x - x, this.body.position.y + f(x));
      }
      this.leftParabola.stroke({ color: 0xff0000, pixelLine: true });
      this.backgroundContainer.addChild(this.leftParabola);

      // draw parabola of jumps to the right
      this.rightParabola = new PIXI.Graphics();
      this.rightParabola.moveTo(this.body.position.x, this.body.position.y);
      for (let x = 0; x < 1000; x++) {
        this.rightParabola.lineTo(this.body.position.x + x, this.body.position.y + f(x));
      }
      this.rightParabola.stroke({ color: 0xff0000, pixelLine: true });
      this.backgroundContainer.addChild(this.rightParabola);

      // draw parabola of jumps to the center
      this.centerTop = new PIXI.Graphics();
      // m/2 = 175
      this.centerTop.moveTo(this.body.position.x - 175, this.body.position.y + h());
      this.centerTop.lineTo(this.body.position.x + 175, this.body.position.y + h());
      this.centerTop.stroke({ color: 0xff0000, pixelLine: true });
      this.backgroundContainer.addChild(this.centerTop);
    }
  }

  drop() {
    Matter.Body.applyForce(this.body, this.body.position, {
      x: 0,
      y: App.config.playerJump / 2
    });

    this.sprite.texture = App.res("playerDropping");
  }

  land(normal: Matter.Vector) {
    this.canJump = true;
    this.sprite.texture = App.sprite("player").texture;
    this.contacts.push(normal);
    Matter.Body.setVelocity(this.body, {
      x: 0,
      y: this.velocity.y
    });

    this.backgroundContainer.removeChild(this.leftParabola);
    this.backgroundContainer.removeChild(this.rightParabola);
    this.backgroundContainer.removeChild(this.centerTop);
  }

  leftPlatform(normal: Matter.Vector) {
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

    this.debugText.text = `${this.body.position.x.toFixed(2)}, ${this.body.position.y.toFixed(2)}`;

    const circle = new PIXI.Graphics();
    circle.circle(this.body.position.x, this.body.position.y, 10);
    circle.fill(0x00ffff);
    this.backgroundContainer.addChild(circle);

    setTimeout(() => {
      this.backgroundContainer.removeChild(circle);
    }, 1000);
  }

  destroy() {
    Matter.World.remove(App.physics.world, this.body);
    this.container.destroy();
  }
}


// explored on desmos: https://www.desmos.com/calculator/pv5ycumls5
const j = 190;
const m = 350;
// debug left and right parabola arc based on config
function f(x: number) {
  return (x / j) * (x - m);
}

// debug center top parabola arc based on config
function h() {
  return -(m * m) / (4 * j);
}
