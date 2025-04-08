import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { Scene } from '../system/Scene';
import { App } from '../system/App';
import { Player } from './Player';
import { Platform } from './Platform';
import { Camera } from './Camera';
import { buildLevel } from '../system/LevelBuilder';
import { Flag } from './Flag';
import { Adversary } from '../ai/Adversary';
import { getLevelNodes } from '../ai/preprocess';

export class GameScene extends Scene {
  camera!: Camera;
  player!: Player;
  playerSpawn!: PIXI.Point;
  platforms!: Platform[];
  flag!: Flag;
  adversary!: Adversary;
  adversarySpawn!: PIXI.Point;
  gameStarted: boolean = false;

  // Stage of the game
  // 0: AI is moving to the flag
  // 1: Player's turn to move
  gameStage: number = 0;
  levelPlan: string[] = [];
  startText: PIXI.Text | null = null;


  start = new PIXI.Graphics();
  end = new PIXI.Graphics();

  create() {
    this.levelPlan = level;
    const { playerStart, AIStart, platforms, levelRect, flagPoint } = buildLevel(this.levelPlan);
    getLevelNodes(this.levelPlan, true);

    this.createCamera(levelRect);

    this.playerSpawn = playerStart;
    this.createPlayer();
    this.createFlag(flagPoint);
    this.createPlatforms(platforms);
    this.adversarySpawn = AIStart;
    this.createAdversary(AIStart);

    this.physicsEvents();
    this.keyEvents();

    // Initially place the player but don't allow movement yet
    this.spawn(this.playerSpawn);
    this.disablePlayerMovement();
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

  createAdversary(start: PIXI.Point) {
    // adversary starts one tile left
    const advStart = new PIXI.Point(start.x, start.y);
    this.adversary = new Adversary(advStart, this.camera.bg.container);
    this.container.addChild(this.adversary.container);
    this.adversary.container.zIndex = 90;
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

  // Disable player movement
  disablePlayerMovement() {
    App.controllerInput.left = false;
    App.controllerInput.right = false;
    App.controllerInput.jump = false;
    App.controllerInput.drop = false;
    this.gameStarted = false;
  }

  // Enable player movement
  enablePlayerMovement() {
    this.gameStarted = true;
    this.gameStage = 1;
  }

  physicsEvents() {
    const group = Matter.Body.nextGroup(true);
    this.adversary.body.collisionFilter.group = group;
    this.player.body.collisionFilter.group = group;

    Matter.Events.on(App.physics, 'beforeUpdate',
      () => {
        // Only allow player movement if the game has started
        if (this.gameStage === 1) {
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

          const entities = [this.player.body, this.adversary.body];

          for (const entity of entities) {
            if (entity.speed > App.config.playerMaxSpeed) {
              Matter.Body.setVelocity(entity, {
                x: App.config.playerMaxSpeed * Math.sign(entity.velocity.x),
                y: Math.min(entity.velocity.y, App.config.playerMaxFallSpeed)
              });
            }
          }
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
            this.resetGame();
          }

          if (player && platform && pair.collision.normal.y <= 0) {
            this.player.land(pair.collision.normal);
            App.controllerInput.drop = false;
          }

          const adversary = colliders.find(body => body.id === this.adversary?.body.id);
          if (adversary && flag) {
            console.log("Adversary reached the flag");
            this.adversary.reachedEnd = true;
          }

          if (adversary && platform) {
            console.log("Adversary landed on platform");
            this.adversary.land();
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
      // Start the game when any key is pressed if we're in stage 0
      if (this.gameStage === 0 && !this.gameStarted) {
        this.enablePlayerMovement();
      }

      // Only register key events if the game has started
      if (this.gameStarted) {
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
          case "Enter":
            const { AIStart, flagPoint } = buildLevel(level);
            this.adversary.goToFlag(AIStart, flagPoint, level);
            this.container.addChild(this.start);
            this.container.addChild(this.end);
        }
      }
    });

    window.addEventListener("keyup", (event) => {
      // Only register key events if the game has started
      if (this.gameStarted) {
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
      }
    });

    window.addEventListener("mousedown", (event) => {
      this.start.clear();

      const tile = new PIXI.Point(
        Math.floor((event.clientX - this.camera.shift.x) / App.config.tileSize),
        Math.floor((event.clientY - this.camera.shift.y) / App.config.tileSize)
      );

      this.start.rect(
        tile.x * App.config.tileSize,
        tile.y * App.config.tileSize,
        App.config.tileSize,
        App.config.tileSize
      );
      this.start.stroke(0x00ff00);
    });

    window.addEventListener("mouseup", (event) => {
      this.end.clear();

      const tile = new PIXI.Point(
        Math.floor((event.clientX - this.camera.shift.x) / App.config.tileSize),
        Math.floor((event.clientY - this.camera.shift.y) / App.config.tileSize)
      );

      this.end.rect(
        tile.x * App.config.tileSize,
        tile.y * App.config.tileSize,
        App.config.tileSize,
        App.config.tileSize
      );
      this.end.stroke(0xff0000);
    });
  }


  update(dt: PIXI.Ticker) {
    if (this.player.body.position.y > this.camera.shift.height) {
      this.spawn(this.playerSpawn);
      this.camera.state = new PIXI.Point(0, 0);
    }

    super.update(dt)

    // Update the camera to follow the player or adversary based on game stage
    if (this.gameStage === 0) {
      this.camera.update(this.adversary.body);
    } else {
      this.camera.update(this.player.body);
    }

    this.platforms.forEach((platform) => {
      this.camera.apply(platform.body);
      platform.update();
    });

    this.camera.apply(this.player.body);
    this.player.update();

    this.camera.apply(this.flag.body);
    this.flag.update();

    // Update the adversary
    this.camera.apply(this.adversary.body);
    this.adversary.update();

    // Check if adversary has completed its path
    if (this.gameStage === 0 && this.adversary.reachedEnd && !this.startText) {
      // Show message to press any key to start
      this.startText = new PIXI.Text({
        text: "AI has shown the way! Press any key to start playing",
        style: {
          fontFamily: "Arial",
          fontSize: 24,
          fill: 0xffffff,
          align: "center"
        }
      });
      this.startText.anchor.set(0.5);
      this.startText.position.set(
        window.innerWidth / 2,
        window.innerHeight / 2 - 100
      );
      this.container.addChild(this.startText);

      // Remove the text after 3 seconds
      setTimeout(() => {
        if (this.startText && this.container.children.includes(this.startText)) {
          this.container.removeChild(this.startText);
          this.startText = null;
        }
      }, 3000);
    }
  }

  resetGame() {
    // Reset player position
    this.spawn(this.playerSpawn);

    // Reset game stage
    this.gameStage = 0;
    this.disablePlayerMovement();

    // Remove any existing messages
    if (this.startText) {
      this.container.removeChild(this.startText);
      this.startText = null;
    }

    // Reset adversary
    if (this.adversary) {
      this.adversary.destroy();
    }

    // Create a new adversary
    this.createAdversary(this.adversarySpawn);
    const group = Matter.Body.nextGroup(true);
    this.adversary.body.collisionFilter.group = group;
    this.player.body.collisionFilter.group = group;
  }
}

export const tlevel = [
  "P                                                          P",
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
  "PPPP                                  P PPP      PPPP      P",
  "P                                                          P",
  "P             PPPPPPPPP                                    P",
  "PPPP                                                PPPPPPPP",
  "P      PPPP             SSS         PPPPPP                 P",
  "P                                                          P",
  "P                                                          P",
  "P                                                          P",
  "P         PP                 P                PPPPPPPP     P",
  "P        PPPP               PP                             P",
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
];

export const oldTestLevel = [
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
  "F                                                                                                                        ",
  "PPPPP    PP                                                                                                              ",
  "          P                 P                                                                                            ",
  "           P                PP                                                                                           ",
  "PPPPP        P          P   P  P                                                                                         ",
  "               X                                                                                                         ",
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
]

export const level = [
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "                                   ",
  "           P   PPPPPPP             ",
  "                                   ",
  "                          P        ",
  "                                   ",
  "                                   ",
  "                               P   ",
  "                                   ",
  "                           P       ",
  "  X A                        F     ",
  "  PPPPPPPPPPPPPPPPPPPPPPPPPPPP     ",
  "                                   ",
];

