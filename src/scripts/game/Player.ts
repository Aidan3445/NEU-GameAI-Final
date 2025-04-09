import * as PIXI from "pixi.js";
import { App } from "../system/App";
import Matter from "matter-js";
import { getLevelNodes, getNodeKey, estimateArc, clearLine } from "../ai/preprocess";

export class Player {
  container: PIXI.Container;
  sprite!: PIXI.Sprite;

  body!: Matter.Body;
  moving: boolean = false;
  canJump: boolean = false;
  jumpCooldown: boolean = false;

  contacts: Matter.Vector[] = [];

  backgroundContainer: PIXI.Container;

  // debug graphics

  leftParabola: PIXI.Graphics = new PIXI.Graphics();
  rightParabola: PIXI.Graphics = new PIXI.Graphics();
  centerTop: PIXI.Graphics = new PIXI.Graphics();

  neighborRects: PIXI.Graphics[] = [];

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
    // console.log(this.body.velocity);
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
    this.sprite.anchor.set(0.5);
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

      this.debugArc();
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

  update(level: string[]) {
    // console.log(this.contacts, this.canJump)
    this.sprite.position = this.body.position;
    this.sprite.rotation = this.body.angle;

    this.debugText.text = `${this.body.position.x.toFixed(2)}, ${this.body.position.y.toFixed(2)}`;

    this.debugTrail();
    this.debugNeighbors(level);
  }

  destroy() {
    Matter.World.remove(App.physics.world, this.body);
    this.container.destroy();
  }

  debugArc() {
    const gridX = this.body.position.x / App.config.tileSize;
    const gridY = this.body.position.y / App.config.tileSize;

    // draw parabola of jumps to the left
    this.leftParabola = new PIXI.Graphics();
    this.leftParabola.moveTo(
      this.body.position.x - App.config.M * App.config.tileSize / 2,
      this.body.position.y - App.config.J * App.config.tileSize);
    for (let x = App.config.M / 2; x <= App.config.M * 1.5; x++) {
      this.leftParabola.lineTo(this.body.position.x - x * App.config.tileSize,
        estimateArc(
          gridX - x,
          gridX,
          gridY,
          gridX - App.config.M,
          gridY,
        ) * App.config.tileSize);
    }
    this.leftParabola.stroke({ color: 0xff0000, pixelLine: true });
    this.backgroundContainer.addChild(this.leftParabola);

    // draw parabola of jumps to the right
    this.rightParabola = new PIXI.Graphics();
    this.rightParabola.moveTo(this.body.position.x + App.config.M * App.config.tileSize / 2,
      this.body.position.y - App.config.J * App.config.tileSize);
    for (let x = App.config.M / 2; x <= App.config.M * 1.5; x++) {
      this.rightParabola.lineTo(this.body.position.x + x * App.config.tileSize,
        estimateArc(
          gridX + x,
          gridX,
          gridY,
          gridX + App.config.M,
          gridY,
        ) * App.config.tileSize);
    }
    this.rightParabola.stroke({ color: 0xff0000, pixelLine: true });
    this.backgroundContainer.addChild(this.rightParabola);

    // draw cap of the parabolas
    this.centerTop = new PIXI.Graphics();
    this.centerTop.moveTo(
      (this.body.position.x - App.config.M * App.config.tileSize / 2),
      (this.body.position.y - App.config.J * App.config.tileSize)
    );
    this.centerTop.lineTo(
      (this.body.position.x + App.config.M * App.config.tileSize / 2),
      (this.body.position.y - App.config.J * App.config.tileSize)
    );

    this.centerTop.stroke({ color: 0xff0000, pixelLine: true });
    this.backgroundContainer.addChild(this.centerTop);
  }

  debugTrail() {
    const circle = new PIXI.Graphics();
    circle.circle(this.body.position.x, this.body.position.y, 10);
    circle.fill(0x00ffff);
    circle.alpha = 0.2;
    this.backgroundContainer.addChild(circle);
    setTimeout(() => {
      this.backgroundContainer.removeChild(circle);
    }, 100);
  }

  debugNeighbors(level: string[]) {
    // remove current neighbor rects
    this.neighborRects.forEach((rect) => {
      this.backgroundContainer.removeChild(rect);
    });
    this.neighborRects = [];
    const nodes = getLevelNodes(level);

    const nodeKey = getNodeKey(
      Math.floor(this.body.position.x / App.config.tileSize),
      Math.floor(this.body.position.y / App.config.tileSize));
    const node = nodes.get(nodeKey);
    if (!node) return;
    const neighbors = node.getNeighbors();
    for (const [key, _] of neighbors) {
      const neighbor = nodes.get(key);

      if (!neighbor) {
        console.warn("Neighbor not found", key, node);
        continue;
      }

      const frame = new PIXI.Graphics();
      frame.rect(neighbor.point.x * App.config.tileSize,
        neighbor.point.y * App.config.tileSize,
        App.config.tileSize,
        App.config.tileSize);
      frame.stroke(0xff00ff);
      this.backgroundContainer.addChild(frame);

      // draw estimated jump arc
      const arc = new PIXI.Graphics();
      arc.moveTo(node.point.x * App.config.tileSize + App.config.tileSize / 2,
        node.point.y * App.config.tileSize + App.config.tileSize / 2);
      let prevX = node.point.x;
      let prevY = node.point.y;
      for (let x = 1; x <= 10; x++) {
        const step = node.point.x + x * (neighbor.point.x - node.point.x) / 10;
        const y = estimateArc(
          step,
          node.point.x,
          node.point.y,
          neighbor.point.x,
          neighbor.point.y,
        );

        arc.lineTo(step * App.config.tileSize + App.config.tileSize / 2,
          y * App.config.tileSize + App.config.tileSize / 2);
        if (clearLine(step, y, prevX, prevY, level)) {
          arc.stroke({ color: 0x00AA00, pixelLine: true });
        } else {
          arc.stroke({ color: 0xAA0000, pixelLine: true });
        }
        prevX = step;
        prevY = y;
      }

      this.backgroundContainer.addChild(arc);
      this.neighborRects.push(arc);

      this.neighborRects.push(frame);
    }
  }
}
