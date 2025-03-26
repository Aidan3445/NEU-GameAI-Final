import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { Scene } from '../system/Scene';
import { App } from '../system/App';
import { Player } from './Player';
import { Platform } from './Platform';
import { Camera } from './Camera';
import { buildLevel } from '../system/LevelBuilder';
import { Flag } from './Flag';
import { getLevelNodes } from '../ai/preprocess';

export class GameScene extends Scene {
  camera!: Camera;
  player!: Player;
  playerSpawn!: PIXI.Point;
  platforms!: Platform[];
  flag!: Flag;

  create() {
    getLevelNodes(level);

    const { playerStart, platforms, levelRect, flagPoint } = buildLevel(oldTestLevel);
    this.createCamera(levelRect);

    this.playerSpawn = playerStart;
    this.createPlayer();
    this.createFlag(flagPoint);

    this.createPlatforms(platforms);

    this.physicsEvents();
    this.keyEvents();

    this.spawn(this.playerSpawn);

  }

  createCamera(levelRect: PIXI.Rectangle) {
    this.camera = new Camera(Camera.CenterFollow, levelRect, this.container);

    this.camera.bg.container.zIndex = -1;
  }

  createPlayer() {
    this.player = new Player(this.camera.bg.container);
    this.container.addChild(this.player.container);

    this.player.container.zIndex = 100;
  }

  createFlag(flagPoint: PIXI.Point) {
    this.flag = new Flag(flagPoint);
    this.container.addChild(this.flag.container);

    this.flag.container.zIndex = 75;
  }

  createPlatforms(platforms: PIXI.Rectangle[]) {
    this.platforms = platforms.map((platform) => {
      const p = new Platform(platform);
      this.container.addChild(p.container);
      p.container.zIndex = 50;
      return p;
    });
  }

  // spawn the player at a specific grid position
  // also sets a spawn point for the player
  spawn(position: PIXI.Point) {
    this.playerSpawn = position;

    position = new PIXI.Point(
      position.x * App.config.tileSize + App.config.tileSize / 2,
      position.y * App.config.tileSize + App.config.tileSize / 2
    );

    Matter.Body.setPosition(this.player.body, position);
  }

  physicsEvents() {
    Matter.Events.on(App.physics, 'beforeUpdate',
      () => {
        if (App.controllerInput.drop && !this.player.canJump) {
          this.player.drop();
          App.controllerInput.drop = false;
        } else {
          if (App.controllerInput.left) this.player.move(-1);
          if (App.controllerInput.right) this.player.move(1);
          if (App.controllerInput.jump && this.player.canJump) {
            this.player.jump();
          }
        }

        if (this.player.body.speed > App.config.playerMaxSpeed) {
          Matter.Body.setVelocity(this.player.body, {
            x: App.config.playerMaxSpeed * Math.sign(this.player.velocity.x),
            y: Math.min(this.player.velocity.y, App.config.playerMaxFallSpeed)
          });
        }
      });

    Matter.Events.on(App.physics, 'collisionStart',
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          const colliders = [pair.bodyA, pair.bodyB];
          const player = colliders.find(body => body.id === this.player?.body.id);
          const platform = colliders.find(body => this.platforms.some(p => p.body.id === body.id));

          const flag = colliders.find(body => body.id === this.flag?.body.id);
          if (player && flag) {
            console.log("Player reached the flag");
            this.spawn(this.playerSpawn);
          }

          if (player && platform && pair.collision.normal.y <= 0) {
            this.player.land(pair.collision.normal);
            App.controllerInput.drop = false;
          }
        });
      });

    Matter.Events.on(App.physics, 'collisionEnd',
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          const colliders = [pair.bodyA, pair.bodyB];
          const player = colliders.find(body => body.id === this.player?.body.id);
          const platform = colliders.find(body => this.platforms.some(p => p.body.id === body.id));
          if (player && platform) {
            // add delay for more forgiving platforming
            setTimeout(() => this.player.leftPlatform(pair.collision.normal), 100);
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
        case "ArrowDown":
        case "s":
          App.controllerInput.drop = true;
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
        case "ArrowDown":
        case "s":
          App.controllerInput.drop = false;
          break;
      }

      if (!App.controllerInput.left && !App.controllerInput.right && this.player.canJump) {
        Matter.Body.setVelocity(this.player.body, {
          x: 0,
          y: this.player.velocity.y
        });
      }
    });
  }

  update(dt: PIXI.Ticker) {
    if (this.player.body.position.y > this.camera.shift.height) {
      console.log("Player fell off the map", this.playerSpawn.x, this.playerSpawn.y,
        this.player.body.position.x, this.player.body.position.y);
      this.spawn(this.playerSpawn);
      this.camera.state = new PIXI.Point(0, 0);
    }

    super.update(dt)

    this.camera.update(this.player.body);

    this.platforms.forEach((platform) => {
      this.camera.apply(platform.body);
      platform.update();
    });

    this.camera.apply(this.player.body);
    this.player.update();

    this.camera.apply(this.flag.body);
    this.flag.update();
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
  "P                                                          P",
  "P             PPPPPPPPP                                    P",
  "PPPP                                                PPPPPPPP",
  "P      PPPP             SSS         PPPPPP                 P",
  "P                                                          P",
  "P                            P                             P",
  "P                            P                             P",
  "P         PP                 P                PPPPPPPP     P",
  "P        PPPP                P                             P",
  "P     PPPPPPPPPPP            P                             P",
  "P                            P                             P",
  "P                     X      P                             P",
  "P               PPPPPPPPPPPPPPP     PPPPPPPPPPPPPPPPP      P",
  "P        SSS                  PP                           P",
  "P    PPPPPPPP                 PPP                          P",
  "P                             PPPP                         P",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
  "PPPPPPPPPPPPPPPPPP      PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
];

const oldTestLevel = [
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "                                                                                                                         ",
  "PPPPP         P                                                                                                          ",
  "               P                                                                                                         ",
  "  X             P                                                                                                        ",
  "PPPPP            P      P                                                                                                ",
  "                                                                                                                         ",
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
]

const testLevel = [
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "                                 ",
  "X  P                             ",
  "P  P                             ",
];

