import * as PIXI from 'pixi.js';
import { Background } from "./Background";
import { Scene } from '../system/Scene';
import { App } from '../system/App';
import { Player } from './Player';
import { Platform } from './Platform';
import Matter from 'matter-js';

export class GameScene extends Scene {
  bg!: Background;
  player!: Player;
  platforms!: Platform[];

  create() {
    this.createBackground();
    this.createPlayer();
    this.createPlatforms(scenePlatforms);

    this.physicsEvents();
    this.keyEvents();
  }

  createBackground() {
    this.bg = new Background();
    this.container.addChild(this.bg.container);
  }

  createPlayer() {
    this.player = new Player(new PIXI.Point(3, 5));
    this.container.addChild(this.player.container);
  }

  createPlatforms(platforms: PIXI.Rectangle[]) {
    this.platforms = platforms.map((platform) => {
      const p = new Platform(platform);
      this.container.addChild(p.container);
      return p;
    });
  }

  physicsEvents() {
    Matter.Events.on(App.physics, 'beforeUpdate',
      () => {
        if (App.controllerInput.left) this.player.move(-1);
        if (App.controllerInput.right) this.player.move(1);
        if (App.controllerInput.jump && this.player.canJump) {
          this.player.jump();
        }

        if (this.player.body.speed > App.config.playerMaxSpeed) {
          Matter.Body.setVelocity(this.player.body, {
            x: App.config.playerMaxSpeed * Math.sign(this.player.body.velocity.x),
            y: this.player.body.velocity.y
          });
        }
      });

    Matter.Events.on(App.physics, 'collisionStart',
      (event: Matter.IEventCollision<Matter.Engine>) => {
        const colliders = [event.pairs[0].bodyA, event.pairs[0].bodyB];
        const player = colliders.find(body => body.id === this.player?.body.id);
        const platform = colliders.find(body => this.platforms.some(p => p.body.id === body.id));

        if (player && platform) {
          this.player.land();
        }
      });
  }

  keyEvents() {
    window.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowLeft":
        case "a":
          App.controllerInput.left = true;
          break;
        case "ArrowRight":
        case "d":
          App.controllerInput.right = true;
          break;
        case "ArrowUp":
        case "w":
        case " ":
          App.controllerInput.jump = true;
          break;
      }
    });

    window.addEventListener("keyup", (event) => {
      switch (event.key) {
        case "ArrowLeft":
        case "a":
          App.controllerInput.left = false;
          break;
        case "ArrowRight":
        case "d":
          App.controllerInput.right = false;
          break;
        case "ArrowUp":
        case "w":
        case " ":
          App.controllerInput.jump = false;
          break;
      }
    });
  }


  update(dt: PIXI.Ticker) {
    super.update(dt)
    if (this.player) {
      this.player.update();

      if (this.player.velocity.x !== 0 || this.player.velocity.y !== 0) {
        const vector = new PIXI.Point(0, 0);

        if (this.player.leftBound() || this.player.rightBound()) {
          vector.x = this.player.velocity.x * dt.deltaTime;
        }

        if (this.player.topBound() || this.player.bottomBound()) {
          vector.y = this.player.velocity.y * dt.deltaTime;
        }

        this.bg.move(vector);
        this.platforms.forEach((platform) => {
          platform.move(vector);
          platform.update();
        });
      }
    }
  }
}

const scenePlatforms = [
  new PIXI.Rectangle(1, 10, 9, 2),
  new PIXI.Rectangle(10, 8, 4, 1),
  new PIXI.Rectangle(15, 7, 16, 1),
];
