import * as PIXI from 'pixi.js';
import { Scene } from '../system/Scene';
import { App } from '../system/App';
import { Player } from './Player';
import { Platform } from './Platform';
import Matter from 'matter-js';
import { Camera } from './Camera';
import { buildLevel } from '../system/LevelBuilder';

export class GameScene extends Scene {
  camera!: Camera;
  player!: Player;
  platforms!: Platform[];

  create() {
    const { playerStart, platforms, cameraBounds } = buildLevel(level);

    this.createCamera(cameraBounds);

    this.createPlayer(playerStart);
    this.createPlatforms(platforms);

    this.physicsEvents();
    this.keyEvents();
  }

  createCamera(cameraBounds: PIXI.Point) {
    this.camera = new Camera(
      Camera.CenterFollow,
      window.innerWidth,
      window.innerHeight,
      cameraBounds,
      this.container
    );
  }

  createPlayer(playerStart: PIXI.Point) {
    this.player = new Player(playerStart);
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

        if (this.player.body.angularSpeed > App.config.playerMaxAngularSpeed) {
          Matter.Body.setAngularSpeed(this.player.body, App.config.playerMaxAngularSpeed * Math.sign(this.player.body.angularVelocity));
        }
      });

    Matter.Events.on(App.physics, 'collisionStart',
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          const colliders = [pair.bodyA, pair.bodyB];
          const player = colliders.find(body => body.id === this.player?.body.id);
          const platform = colliders.find(body => this.platforms.some(p => p.body.id === body.id));
          if (player && platform && pair.collision.normal.y <= 0) {
            this.player.land();
          }
        });
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
          this.player.move(0.1);
          this.player.moving = false;
          break;
        case "ArrowRight":
        case "d":
          App.controllerInput.right = false;
          this.player.move(-0.1);
          this.player.moving = false;
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

    this.camera.update(this.player.body);
    this.camera.apply(this.player.body);

    this.platforms.forEach((platform) => {
      this.camera.apply(platform.body);
      platform.update();
    });
    this.player.update();
  }
}

const level = [
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "P                                                          P",
  "P                                                          P",
  "P                                                          P",
  "P             F                     PPPPPP       SS        P",
  "P           PPPPPPP                            PPPPPPP     P",
  "P   PPPP                 PPPPPPP                           P",
  "P            SSS                                        PPPP",
  "PPPP    PPPPPPPP                                           P",
  "P                                                PPPP      P",
  "P   PPPP                         PPPPPPP                   P",
  "P                                                          P",
  "P                   SSS                                 PPPP",
  "P      PPPPPP       PPPPPPPPP                PPPPP         P",
  "P                                PPPPPP                 PPPP",
  "P                                                          P",
  "P                                       P                  P",
  "PPPP        PPPPPPPP                     P                 P",
  "P                         PPPPPP          P             PPPP",
  "P                                                          P",
  "PPPP                                 PP PPP      PPPP      P",
  "P              PPPPPPP                                     P",
  "P                                                          P",
  "PPPP                                                PPPPPPPP",
  "P      PPPP             SSS                                P",
  "P                                                          P",
  "P                                                          P",
  "P               PPPPPPPPPPPPPPP     PPPPPPPPPPPPPPPPP      P",
  "P        SSS                  PP                           P",
  "P    PPPPPPPP         X       PPP                          P",
  "P                             PPPP                         P",
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP"
]
