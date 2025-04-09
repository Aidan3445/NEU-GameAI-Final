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
import { ItemType } from '../ai/ItemSelector';

import { Spike } from './Spike';
import { ItemButton } from './ItemButton';
import { level, oldTestLevel, rlevel } from './levels';
import { ItemSelector } from '../ai/ItemSelector';

export class GameScene extends Scene {
  camera!: Camera;
  player!: Player;
  playerSpawn!: PIXI.Point;
  platforms!: Platform[];
  flag!: Flag;
  adversary!: Adversary;
  gameStarted: boolean = false;
  adversaryStart!: PIXI.Point;

  // Game stages
  // 0: Item selection phase - player selects an item
  // 1: Item selection phase - AI selects an item
  // 2: Item placement phase - player places their item
  // 3: Item placement phase - AI places its item
  // 4: AI pathfinding to the flag
  // 5: Player's turn to move
  gameStage: number = 0;
  levelPlan!: string[];
  startText: PIXI.Text | null = null;
  spikes!: Spike[];

  // Item selection related properties
  availableItems!: ItemType[];
  playerItem: ItemType | null = null;
  aiItem: ItemType | null = null;
  itemSelectionUI!: PIXI.Container;
  itemPlacementActive: boolean = false;
  itemPlacementPreview: PIXI.Graphics | null = null;
  selectedPlatforms: Platform[] = [];
  selectedSpike?: Spike;
  flagPoint!: PIXI.Point;
  placementText: PIXI.Text | null = null;

  create() {
    this.levelPlan = level;
    const { playerStart, AIStart, platforms, spikes, levelRect, flagPoint } = buildLevel(this.levelPlan);
    getLevelNodes(this.levelPlan, true);

    this.createCamera(levelRect);
    this.flagPoint = flagPoint;
    this.playerSpawn = playerStart;
    this.createFlag(flagPoint);
    this.createPlatforms(platforms);
    this.createSpikes(spikes);
    this.adversaryStart = AIStart;
    this.availableItems = this.randomizeItems();
    this.createItemButtons();

    this.createPlayer();
    this.spawn(this.playerSpawn)
    this.disablePlayerMovement();

    this.createAdversary(AIStart);

    this.physicsEvents();
    this.keyEvents();
  }

  createCamera(levelRect: PIXI.Rectangle) {
    this.camera = new Camera(Camera.Fixed, levelRect, this.container);

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

  createSpikes(spikes: PIXI.Point[]) {
    this.spikes = spikes.map((spike) => {
      const s = new Spike(spike);
      this.container.addChild(s.container);
      s.container.zIndex = 50;
      return s;
    });
  }

  addSpike(spike: Spike) {
    // check if the position is not valid
    if (this.levelPlan.length <= spike.gridPoint.y ||
      this.levelPlan[spike.gridPoint.y].length <= spike.gridPoint.x) {
      console.error("Invalid spike position");
      return;
    }

    this.spikes.push(spike);
    this.container.addChild(spike.container);
    spike.container.zIndex = 50;

    this.updateLevelPlan(spike.gridPoint, 'S', 1);
  }

  createPlatforms(platforms: PIXI.Rectangle[]) {
    this.platforms = platforms.map((platform) => {
      const p = new Platform(platform);
      this.container.addChild(p.container);
      p.container.zIndex = 50;
      return p;
    });
  }

  addPlatform(platform: Platform) {
    // check if the position is not valid
    if (this.levelPlan.length <= platform.gridRect.y ||
      this.levelPlan[platform.gridRect.y].length <= platform.gridRect.x) {
      console.error("Invalid platform position");
      return;
    }

    this.platforms.push(platform);
    this.container.addChild(platform.container);
    platform.container.zIndex = 50;

    for (let i = 0; i < platform.gridRect.height; i++) {
      this.updateLevelPlan(
        new PIXI.Point(platform.gridRect.x, platform.gridRect.y + i),
        'P',
        platform.gridRect.width
      );
    }
  }

  blowUpPlatform(platform: Platform) {
    this.platforms = this.platforms.filter(p => p !== platform);
    this.container.removeChild(platform.container);
    platform.destroy();

    for (let i = 0; i < platform.gridRect.height; i++) {
      this.updateLevelPlan(
        new PIXI.Point(platform.gridRect.x, platform.gridRect.y + i),
        ' ',
        platform.gridRect.width
      );
    }
  }

  blowUpSpike(spike: Spike) {
    this.spikes = this.spikes.filter(s => s !== spike);
    this.container.removeChild(spike.container);
    spike.destroy();

    this.updateLevelPlan(spike.gridPoint, ' ', 1);
  }

  createAdversary(start: PIXI.Point) {
    const advStart = new PIXI.Point(start.x, start.y);
    this.adversary = new Adversary(advStart, this.camera.bg.container);
    this.container.addChild(this.adversary.container);
    this.adversary.container.zIndex = 90;
  }

  updateLevelPlan(cell: PIXI.Point, newChar: string, length: number) {
    console.log('updating level plan', cell, newChar, length, this.levelPlan);
    this.levelPlan[cell.y] = this.levelPlan[cell.y].substring(0, cell.x) +
      newChar.repeat(length) +
      this.levelPlan[cell.y].substring(cell.x + 1 + length);
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
  }

  // Enable player movement
  enablePlayerMovement() {
    this.gameStage = 5;
  }

  physicsEvents() {
    const group = Matter.Body.nextGroup(true);
    this.adversary.body.collisionFilter.group = group;
    this.player.body.collisionFilter.group = group;

    Matter.Events.on(App.physics, 'beforeUpdate',
      () => {
        // Only allow player movement if the game has started and player is not trapped
        if (this.gameStage === 5) {
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

          entities.forEach((entity) => {
            if (entity.speed > App.config.playerMaxSpeed) {
              Matter.Body.setVelocity(entity, {
                x: App.config.playerMaxSpeed * Math.sign(entity.velocity.x),
                y: Math.min(entity.velocity.y, App.config.playerMaxFallSpeed)
              });
            }
          });
        }
      });

    Matter.Events.on(App.physics, 'collisionStart',
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          const colliders = [pair.bodyA, pair.bodyB];

          const player = colliders.find(body => body.id === this.player?.body.id);
          const adversary = colliders.find(body => body.id === this.adversary?.body.id);

          const platform = colliders.find(body => this.platforms.some(p => p.body.id === body.id));
          const flag = colliders.find(body => body.id === this.flag?.body.id);
          //console.log('hi', this.spikes)
          const spike = colliders.find(body => this.spikes.some(s => s.body.id === body.id));

          if (player && flag) {
            console.log("Player won!");
            this.resetGame();
          }

          // if (player && platform) {
          //   console.log(player.position.x, player.position.y, pair, platform.position.x, platform.position.y);
          // }

          if (player && platform && (pair.collision.normal.y === 0 ||
            player.position.y < platform.position.y)) {
            console.log('player landing')
            this.player.land(pair.collision.normal);
            App.controllerInput.drop = false;
          }

          if (adversary && flag) {
            console.log("Adversary won!");
            this.resetGame();
          }

          if (adversary && platform && (pair.collision.normal.y === 0 ||
            adversary.position.y < platform.position.y)) {
            this.adversary.land();
          }

          if (player && spike) {
            // somehow lag player behind
            console.log("AI won, player died");
            this.resetGame();
          }

        });
      });

    Matter.Events.on(App.physics, 'collisionEnd',
      (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach((pair) => {
          const colliders = [pair.bodyA, pair.bodyB];

          const player = colliders.find(body => body.id === this.player?.body.id);
          const adversary = colliders.find(body => body.id === this.adversary?.body.id);

          const platform = colliders.find(body => this.platforms.some(p => p.body.id === body.id));
          const spike = colliders.find(body => this.spikes.some(s => s.body.id === body.id));

          if (player && platform) {
            // add delay for more forgiving platforming
            setTimeout(() => this.player.leftPlatform(pair.collision.normal), 100);
          }

        });
      });
  }

  keyEvents() {
    window.addEventListener("keydown", (event) => {
      // Only register key events if the game has started and we're in player movement stage
      if (this.gameStage === 5) {
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
      }
    });

    window.addEventListener("keyup", (event) => {
      // Only register key events if the game has started
      if (this.gameStage === 5) {
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

        console.log(!App.controllerInput.left, !App.controllerInput.right, this.player.canJump)
        if (!App.controllerInput.left && !App.controllerInput.right && this.player.canJump) {
          console.log('jumping')
          Matter.Body.setVelocity(this.player.body, {
            x: 0,
            y: this.player.velocity.y
          });
        }
      }
    });
  }


  update(dt: PIXI.Ticker) {
    // console.log(this.itemSelectionUI)

    // this is the starting game stage, player has not chosen an item yet
    if (this.gameStage === 0) {
      return;
    }

    // move gameStage forward to AI picking
    if (this.gameStage === 1) {
      this.container.removeChild(this.itemSelectionUI!);
      // selectAIItem will increase gameStage once the AI picks the item
      this.selectAIItem();
      return;
    }

    if (this.gameStage === 2) {
      // Move to AI placement phase
      this.startItemPlacement();
      return;
    }

    if (this.gameStage === 3) {
      console.log('GAME STAGE is 3')
      this.enablePlayerMovement()
      this.adversary.goToFlag(this.adversaryStart, this.flagPoint, this.levelPlan);
      return;
    }

    if (this.player.body.position.y > this.camera.shift.height) {
      console.log("Player fell off the map", this.playerSpawn.x, this.playerSpawn.y,
        this.player.body.position.x, this.player.body.position.y);
      this.spawn(this.playerSpawn);
      // this.camera.state = new PIXI.Point(0, 0);
    }

    super.update(dt)

    // Update the camera based on the current game stage
    // if (this.gameStage <= 4) {
    //   this.camera.update(this.adversary.body);
    // } else {
    //   this.camera.update(this.player.body);
    // }

    this.platforms.forEach((platform) => {
      // this.camera.apply(platform.body);
      platform.update();
    });

    this.spikes.forEach((spike) => {
      // this.camera.apply(platform.body);
      spike.update();
    });

    // this.camera.apply(this.player.body);
    this.player.update(this.levelPlan);

    // this.camera.apply(this.flag.body);
    this.flag.update();

    // Update the adversary
    // this.camera.apply(this.adversary.body);
    this.adversary.update();

  }

  resetGame() {
    // Reset player position
    this.spawn(this.playerSpawn);

    // Reset game stage and items
    this.gameStage = 0;
    this.playerItem = null;
    this.aiItem = null;
    this.disablePlayerMovement();

    // Reset adversary
    if (this.adversary) {
      this.adversary.destroy();
    }

    // Create a new adversary
    this.createAdversary(this.adversaryStart);

    // Start item selection again
    this.createItemButtons();
  }

  randomizeItems() {
    const randomItems = [];
    const allItems = [ItemType.Platform, ItemType.Bomb, ItemType.Spikes];
    for (let i = 0; i < allItems.length; i++) {
      const randomIndex = Math.floor(Math.random() * allItems.length);
      randomItems.push(allItems[randomIndex]);
    }
    return randomItems;
  }

  createItemButtons() {
    // change this list to add more items to the selection
    this.itemSelectionUI = new PIXI.Container();

    // Create the buttons
    for (let i = 0; i < this.availableItems.length; i++) {
      const button = new ItemButton(this.availableItems[i], i);
      const itemValue = this.availableItems[i]; // Store the current item

      button.bg.on('pointerdown', () => {
        if (this.gameStage === 0) {
          console.log('Item selected:', itemValue);
          this.playerItem = itemValue;

          // Remove this item from the array of items
          this.availableItems.splice(this.availableItems.indexOf(itemValue), 1);

          this.gameStage = 1;
        }
      });
      this.itemSelectionUI.addChild(button.button);
    }

    this.container.addChild(this.itemSelectionUI);
  }

  /**
   * AI selects an item using the behavior tree
   */
  selectAIItem() {
    this.gameStage = 0;
    // Get player position
    // const playerPosition = new PIXI.Point(
    //   this.player.body.position.x / App.config.tileSize,
    //   this.player.body.position.y / App.config.tileSize
    // );

    // TODO: change this to use the behavior tree
    // this.aiItem = this.adversary.selectItem(this.availableItems, this.playerItem, playerPosition);
    console.log('Available items:', this.availableItems);
    this.aiItem = this.selectItemUsingBehaviorTree(this.availableItems);

    // Create info text about AI's selection
    const aiSelectionText = new PIXI.Text({
      text: `AI selected: ${this.aiItem}, waiting 3 seconds...`,
      style: {
        fontFamily: "Arial",
        fontSize: 24,
        fill: 0xffffff,
        align: "center"
      }
    });
    aiSelectionText.anchor.set(0.5);
    aiSelectionText.position.set((window.innerWidth / 2) + 1000, window.innerHeight / 2 - 100);
    this.container.addChild(aiSelectionText);

    // Display for 3 seconds then move to item placement phase
    setTimeout(() => {
      this.container.removeChild(aiSelectionText);
      this.gameStage = 2;
    }, 500);
  }

  /**
   * Start the item placement phase for the player
   */
  startItemPlacement() {
    this.gameStage = 0;

    // Show instructions
    const placementText = new PIXI.Text({
      text: `Click to place your ${this.playerItem}`,
      style: {
        fontFamily: "Arial",
        fontSize: 24,
        fill: 0xffffff,
        align: "center"
      }
    });
    placementText.anchor.set(0.5);
    placementText.position.set((window.innerWidth / 2) + 1000, 50);
    this.container.addChild(placementText);

    // Create preview graphics
    this.itemPlacementPreview = new PIXI.Graphics();
    this.container.addChild(this.itemPlacementPreview);
    this.itemPlacementPreview.zIndex = 150;

    // Enable placement mode
    this.itemPlacementActive = true;

    // Remove any existing event listeners first to prevent duplicates
    window.removeEventListener("mousemove", this.onItemPlacementMouseMove);
    window.removeEventListener("click", this.onItemPlacementClick);

    // Setup mouse move and click events
    window.addEventListener("mousemove", this.onItemPlacementMouseMove);
    window.addEventListener("click", this.onItemPlacementClick);

    // Store references to event listeners
    this.placementText = placementText;

    console.log("Item placement started for item:", this.playerItem);
  }

  /**
   * Handle mouse movement during item placement
   */
  onItemPlacementMouseMove = (event: MouseEvent) => {
    if (!this.itemPlacementActive || !this.itemPlacementPreview || !this.playerItem) return;

    // Convert mouse position to world coordinates
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Calculate grid position (snap to grid)
    const gridX = Math.floor(mouseX / App.config.tileSize) * App.config.tileSize;
    const gridY = Math.floor(mouseY / App.config.tileSize) * App.config.tileSize;

    // Update preview based on selected item
    this.itemPlacementPreview.clear();
    switch (this.playerItem) {
      case ItemType.Platform:
        this.itemPlacementPreview.beginFill(0x995533, 0.7);
        this.itemPlacementPreview.drawRect(
          gridX,
          gridY,
          App.config.tileSize * 3,
          App.config.tileSize
        );
        this.itemPlacementPreview.endFill();
        break;

      case ItemType.Bomb:
        // Highlight platforms under cursor
        this.selectedPlatforms = this.platforms.filter(platform => {
          const bounds = platform.container.getBounds();

          // is under player spawn point
          if (platform.gridRect.x <= this.playerSpawn.x &&
            platform.gridRect.x + platform.gridRect.width >= this.playerSpawn.x &&
            platform.gridRect.y === this.playerSpawn.y + 1) {
            return false;
          }

          // is under adversary spawn point
          if (platform.gridRect.x <= this.adversaryStart.x &&
            platform.gridRect.x + platform.gridRect.width >= this.adversaryStart.x &&
            platform.gridRect.y === this.adversaryStart.y + 1) {
            return false;
          }

          // is under flag point
          if (platform.gridRect.x <= this.flagPoint.x &&
            platform.gridRect.x + platform.gridRect.width >= this.flagPoint.x &&
            platform.gridRect.y === this.flagPoint.y + 1) {
            return false;
          }

          return mouseX >= bounds.x && mouseX <= bounds.x + bounds.width &&
            mouseY >= bounds.y && mouseY <= bounds.y + bounds.height;
        });

        this.selectedSpike = this.spikes.find(spike => {
          const bounds = spike.container.getBounds();
          return mouseX >= bounds.x && mouseX <= bounds.x + bounds.width &&
            mouseY >= bounds.y && mouseY <= bounds.y + bounds.height;
        });

        if (this.selectedPlatforms.length > 0) {
          this.selectedPlatforms.forEach(platform => {
            if (this.itemPlacementPreview) {
              const bounds = platform.container.getBounds();
              this.itemPlacementPreview.beginFill(0xff0000, 0.5);
              this.itemPlacementPreview.drawRect(
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height
              );
              this.itemPlacementPreview.endFill();
            }
          });
        } else if (this.selectedSpike && this.itemPlacementPreview) {
          const bounds = this.selectedSpike.container.getBounds();
          this.itemPlacementPreview.beginFill(0xff0000, 0.5);
          this.itemPlacementPreview.drawRect(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height
          );
          this.itemPlacementPreview.endFill();
        } else if (this.itemPlacementPreview) {
          this.itemPlacementPreview.beginFill(0xff0000, 0.5);
          this.itemPlacementPreview.drawCircle(mouseX, mouseY, 20);
          this.itemPlacementPreview.endFill();
        }
        break;

      case ItemType.Spikes:
        this.itemPlacementPreview.beginFill(0xaaaaaa, 0.7);
        for (let i = 0; i < 3; i++) {
          this.itemPlacementPreview.moveTo(gridX + i * (App.config.tileSize / 3), gridY + App.config.tileSize);
          this.itemPlacementPreview.lineTo(gridX + (i + 0.5) * (App.config.tileSize / 3), gridY);
          this.itemPlacementPreview.lineTo(gridX + (i + 1) * (App.config.tileSize / 3), gridY + App.config.tileSize);
        }
        this.itemPlacementPreview.endFill();
        break;
    }
  }

  /**
   * Handle mouse click during item placement
   */
  onItemPlacementClick = (event: MouseEvent) => {
    if (!this.itemPlacementActive || !this.playerItem) {
      console.log("Item placement not active or no item selected");
      return;
    }

    console.log("Item placement click detected for item:", this.playerItem);

    // Convert mouse position to world coordinates
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Calculate grid position (snap to grid)
    const gridX = Math.floor(mouseX / App.config.tileSize);
    const gridY = Math.floor(mouseY / App.config.tileSize);

    console.log("Placing at grid position:", gridX, gridY);

    // Apply the item effect based on type
    switch (this.playerItem) {
      case ItemType.Platform:
        console.log("Creating platform at", gridX, gridY);
        // TODO: make these be passed into from the ItemType
        // Maybe make ItemType a class and not a Enum to hold more info.
        const rectW = 3
        const rectH = 1
        const rect = new PIXI.Rectangle(gridX, gridY, rectW, rectH);
        const platform = new Platform(rect)
        this.addPlatform(platform)
        break;

      case ItemType.Bomb:
        // Remove selected platform if any (except flag platform)
        if (this.selectedPlatforms.length > 0) {
          this.selectedPlatforms.forEach(platform => {
            // Check if it's the flag platform
            const flagPlatformY = Math.floor(this.flagPoint.y) + 1;
            const flagPlatformX = Math.floor(this.flagPoint.x);
            const platformY = Math.floor(platform.body.position.y / App.config.tileSize);
            const platformX = Math.floor(platform.body.position.x / App.config.tileSize);

            if (platformY !== flagPlatformY || Math.abs(platformX - flagPlatformX) > 1) {
              // Not a flag platform, remove it
              this.blowUpPlatform(platform);
            }
          });
        } else if (this.selectedSpike) {
          // Remove selected spike if any
          this.blowUpSpike(this.selectedSpike);
        }
        break;

      case ItemType.Spikes:
        console.log("Creating spikes at", gridX, gridY);
        const spike = new Spike(new PIXI.Point(gridX, gridY));
        this.addSpike(spike);
        break;
    }

    // Cleanup and move to AI placement
    this.finishItemPlacement();
  }

  /**
   * Clean up after item placement is done
   */
  finishItemPlacement() {
    // Remove event listeners
    window.removeEventListener("mousemove", this.onItemPlacementMouseMove);
    window.removeEventListener("click", this.onItemPlacementClick);

    // Clean up UI
    if (this.itemPlacementPreview) {
      this.container.removeChild(this.itemPlacementPreview);
      this.itemPlacementPreview = null;
    }

    if (this.placementText) {
      this.container.removeChild(this.placementText);
      this.placementText = null;
    }

    this.itemPlacementActive = false;
    this.selectedPlatforms = [];

    this.placeAIItem();
  }

  /**
   * Uses the behavior tree to select an item for the AI
   */
  selectItemUsingBehaviorTree(availableItems: ItemType[]): ItemType {
    const playerPosition = this.playerSpawn;
    const aiPosition = this.adversaryStart;
    const flagPosition = this.flagPoint;

    // Create an instance of ItemSelector and use it to select an item using the behavior tree
    const itemSelector = new ItemSelector(availableItems);
    return itemSelector.selectItem(
      this.playerItem!,
      this.levelPlan,
      playerPosition,
      aiPosition,
      flagPosition
    );
  }

  /**
   * AI places its selected item
   */
  placeAIItem() {
    if (!this.aiItem) return;

    // Show message about AI's action
    const aiActionText = new PIXI.Text({
      text: `AI is placing its ${this.aiItem}...`,
      style: {
        fontFamily: "Arial",
        fontSize: 24,
        fill: 0xffffff,
        align: "center"
      }
    });
    aiActionText.anchor.set(0.5);
    aiActionText.position.set(window.innerWidth / 2, 50);
    this.container.addChild(aiActionText);

    // Determine where AI should place its item

    // TODO: revamp determineItemPlacement
    // const placementPosition = this.adversary.determineItemPlacement();
    const placementPosition = new PIXI.Point(500, 500)
    const gridX = Math.floor(placementPosition.x);
    const gridY = Math.floor(placementPosition.y);

    // Wait a bit for dramatic effect, then place the item
    setTimeout(() => {
      switch (this.aiItem) {
        case ItemType.Platform:
          console.log("AI creating platform at", gridX, gridY);
          // TODO same as the player Platform, have this Platform type take in a W and a H
          const rectW = 3
          const rectH = 1
          const rect = new PIXI.Rectangle(gridX, gridY, rectW, rectH);
          const platform = new Platform(rect)
          this.addPlatform(platform)
          break;
        case ItemType.Bomb:
          // Find closest platform to the target position
          let closestPlatform = null;
          let minDistance = Infinity;

          for (const platform of this.platforms) {
            const platformX = Math.floor(platform.body.position.x / App.config.tileSize);
            const platformY = Math.floor(platform.body.position.y / App.config.tileSize);

            // Check if it's the flag platform
            const flagPlatformY = Math.floor(this.flagPoint.y) + 1;
            const flagPlatformX = Math.floor(this.flagPoint.x);

            if (platformY !== flagPlatformY || Math.abs(platformX - flagPlatformX) > 1) {
              // Not a flag platform, can be removed
              const dist = Math.sqrt(
                Math.pow(platformX - gridX, 2) +
                Math.pow(platformY - gridY, 2)
              );

              if (dist < minDistance) {
                minDistance = dist;
                closestPlatform = platform;
              }
            }
          }

          // Remove the closest platform
          if (closestPlatform) {
            this.blowUpPlatform(closestPlatform);
          }
          break;

        case ItemType.Spikes:
          console.log("AI creating spikes at", gridX, gridY);
          const spike = new Spike(new PIXI.Point(gridX, gridY));
          this.addSpike(spike)
          break;
      }

      // Clean up and move to pathfinding phase
      this.container.removeChild(aiActionText);
      this.gameStage = 3;
      console.log('moving game to stage 3, All placing should be complete and the game will start')
    }, 500);
  }

}

