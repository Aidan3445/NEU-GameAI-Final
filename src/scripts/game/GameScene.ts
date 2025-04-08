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

export class GameScene extends Scene {
  camera!: Camera;
  player!: Player;
  playerSpawn!: PIXI.Point;
  platforms!: Platform[];
  flag!: Flag;
  adversary!: Adversary;
  gameStarted: boolean = false;

  // Game stages
  // 0: Item selection phase - player selects an item
  // 1: Item selection phase - AI selects an item
  // 2: Item placement phase - player places their item
  // 3: Item placement phase - AI places its item
  // 4: AI pathfinding to the flag
  // 5: Player's turn to move
  gameStage: number = 0;
  levelPlan: string[] = [];
  startText: PIXI.Text | null = null;
  
  // Item selection related properties
  availableItems = [ItemType.Platform, ItemType.Bomb, ItemType.Spikes];
  playerItem: ItemType | null = null;
  aiItem: ItemType | null = null;
  itemButtons: PIXI.Container[] = [];
  itemSelectionUI: PIXI.Container | null = null;
  itemPlacementActive: boolean = false;
  itemPlacementPreview: PIXI.Graphics | null = null;
  selectedPlatforms: Platform[] = [];
  flagPoint!: PIXI.Point;
  placementText: PIXI.Text | null = null;
  // Track spike locations for collision detection
  spikeLocations: {x: number, y: number, width: number, height: number}[] = [];
  playerTrapped: boolean = false;
  trapTimer: number = 0;
  activeSpikeIndex: number = -1; // Track which spike trapped the player
  spikesGraphicsObjects: PIXI.Graphics[] = []; // Track the graphics objects for spikes

  create() {
    this.levelPlan = level;
    const { playerStart, platforms, levelRect, flagPoint } = buildLevel(this.levelPlan);
    getLevelNodes(this.levelPlan, true);

    this.createCamera(levelRect);
    this.flagPoint = flagPoint;
    this.playerSpawn = playerStart;
    this.createPlayer();
    this.createFlag(flagPoint);
    this.createPlatforms(platforms);
    this.createAdversary(playerStart, flagPoint);

    this.physicsEvents();
    this.keyEvents();

    // Initially place the player but don't allow movement yet
    this.spawn(this.playerSpawn);
    this.disablePlayerMovement();

    const group = Matter.Body.nextGroup(true);
    this.adversary.body.collisionFilter.group = group;
    this.player.body.collisionFilter.group = group;
    
    // Start with item selection UI
    this.createItemSelectionUI();
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

  createPlatforms(platforms: PIXI.Rectangle[]) {
    this.platforms = platforms.map((platform) => {
      const p = new Platform(platform);
      this.container.addChild(p.container);
      p.container.zIndex = 50;
      return p;
    });
  }

  createAdversary(start: PIXI.Point, target: PIXI.Point) {
    // adversary starts one tile left
    const advStart = new PIXI.Point(start.x - 1, start.y);
    this.adversary = new Adversary(advStart, target, this.camera.bg.container, this.levelPlan);
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
    this.gameStage = 5;
  }

  physicsEvents() {
    // allow player and adversary to pass through each other
    this.player.body.collisionFilter.group = -1;
    this.adversary.body.collisionFilter.group = -1;

    Matter.Events.on(App.physics, 'beforeUpdate',
      () => {
        // Only allow player movement if the game has started and player is not trapped
        if (this.gameStage === 5 && !this.playerTrapped) {
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
          } 
 
          //  I removed: && pair.collision.normal.y <= 0. Why is this here?
          if (adversary && platform) {
            this.adversary.land(pair.collision.normal);
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

          const adversary = colliders.find(body => body.id === this.adversary?.body.id);
          if (adversary && platform) {
            setTimeout(() => this.adversary.leftPlatform(pair.collision.normal), 100);
          }

        });
      });
  } 

  keyEvents() {
    window.addEventListener("keydown", (event) => {
      // Start the game when any key is pressed during pathfinding stage
      if (this.gameStage === 4 && this.adversary.reachedEnd && !this.gameStarted) {
        this.enablePlayerMovement();
      }

      // Only register key events if the game has started and we're in player movement stage
      if (this.gameStarted && this.gameStage === 5) {
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
  }
  

  update(dt: PIXI.Ticker) {
    if (this.player.body.position.y > this.camera.shift.height) {
      console.log("Player fell off the map", this.playerSpawn.x, this.playerSpawn.y,
        this.player.body.position.x, this.player.body.position.y);
      this.spawn(this.playerSpawn);
      this.camera.state = new PIXI.Point(0, 0);
    }

    super.update(dt)

    // Update the camera based on the current game stage
    if (this.gameStage <= 4) {
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
    
    // Check for spike collisions during gameplay
    if (this.gameStage === 5 && this.spikeLocations.length > 0 && !this.playerTrapped) {
      const playerX = this.player.body.position.x;
      const playerY = this.player.body.position.y;
      const playerWidth = this.player.sprite.width * 0.8; // Use 80% of width for better hit detection
      const playerHeight = this.player.sprite.height * 0.8;
      
      // Check if player is on any spike
      for (let i = 0; i < this.spikeLocations.length; i++) {
        const spike = this.spikeLocations[i];
        if (this.checkCollision(
          playerX - playerWidth/2, playerY - playerHeight/2, playerWidth, playerHeight,
          spike.x, spike.y, spike.width, spike.height
        )) {
          console.log("Player stepped on spikes!");
          this.playerTrapped = true;
          this.trapTimer = 180; // Trap player for 3 seconds (60fps * 3)
          this.activeSpikeIndex = i; // Remember which spike was triggered
          
          // Show trap message
          if (!this.startText) {
            this.startText = new PIXI.Text({
              text: "You stepped on spikes! Can't move for 3 seconds",
              style: {
                fontFamily: "Arial",
                fontSize: 24,
                fill: 0xff0000,
                align: "center"
              }
            });
            this.startText.anchor.set(0.5);
            this.startText.position.set(
              window.innerWidth / 2,
              window.innerHeight / 2 - 100
            );
            this.container.addChild(this.startText);
          }
          
          break;
        }
      }
    }
    
    // Update trap timer if player is trapped
    if (this.playerTrapped) {
      this.trapTimer--;
      
      // Force player to stop moving when trapped
      Matter.Body.setVelocity(this.player.body, {
        x: 0,
        y: this.player.velocity.y
      });
      
      // Reset trapped state after timer expires and remove the spike
      if (this.trapTimer <= 0) {
        this.playerTrapped = false;
        
        // Remove trap message
        if (this.startText) {
          this.container.removeChild(this.startText);
          this.startText = null;
        }
        
        // Remove the spike that trapped the player
        if (this.activeSpikeIndex >= 0 && this.activeSpikeIndex < this.spikeLocations.length) {
          // Remove the graphics object from the container
          if (this.spikesGraphicsObjects[this.activeSpikeIndex]) {
            this.container.removeChild(this.spikesGraphicsObjects[this.activeSpikeIndex]);
          }
          
          // Remove from the arrays
          this.spikeLocations.splice(this.activeSpikeIndex, 1);
          this.spikesGraphicsObjects.splice(this.activeSpikeIndex, 1);
          
          this.activeSpikeIndex = -1; // Reset the active spike index
        }
      }
    }

    // Check if adversary has completed its path during the pathfinding stage
    if (this.gameStage === 4 && this.adversary.reachedEnd && !this.startText) {
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

    // Reset game stage and items
    this.gameStage = 0;
    this.playerItem = null;
    this.aiItem = null;
    this.disablePlayerMovement();
    
    // Reset spike trap state
    this.spikeLocations = [];
    this.playerTrapped = false;
    this.trapTimer = 0;
    this.activeSpikeIndex = -1;
    
    // Clean up all spike graphics
    for (const spikesGraphics of this.spikesGraphicsObjects) {
      if (spikesGraphics && this.container.children.includes(spikesGraphics)) {
        this.container.removeChild(spikesGraphics);
      }
    }
    this.spikesGraphicsObjects = [];

    // Remove any existing messages
    if (this.startText) {
      this.container.removeChild(this.startText);
      this.startText = null;
    }

    // Clean up any item placement UI
    if (this.itemPlacementPreview) {
      this.container.removeChild(this.itemPlacementPreview);
      this.itemPlacementPreview = null;
    }
    
    // Reset adversary
    if (this.adversary) {
      this.adversary.destroy();
    }

    // Create a new adversary
    this.createAdversary(this.playerSpawn, new PIXI.Point(
      this.flag.body.position.x / App.config.tileSize,
      this.flag.body.position.y / App.config.tileSize
    ));
    
    // Start item selection again
    this.createItemSelectionUI();
  }

  /**
   * Create the UI for item selection
   */
  createItemSelectionUI() {
    // Reset the buttons array
    this.itemButtons = [];
    
    // Create container for UI elements
    this.itemSelectionUI = new PIXI.Container();
    this.container.addChild(this.itemSelectionUI);
    this.itemSelectionUI.zIndex = 1000;
    
    // Create title text
    const titleText = new PIXI.Text({
      text: "Select an item:",
      style: {
        fontFamily: "Arial",
        fontSize: 24,
        fill: 0xffffff,
        align: "center"
      }
    });
    titleText.anchor.set(0.5, 0);
    titleText.position.set(window.innerWidth / 2, 50);
    this.itemSelectionUI.addChild(titleText);
    
    // Create description text
    const descriptionText = new PIXI.Text({
      text: "You'll place this item before the game starts",
      style: {
        fontFamily: "Arial",
        fontSize: 16,
        fill: 0xcccccc,
        align: "center"
      }
    });
    descriptionText.anchor.set(0.5, 0);
    descriptionText.position.set(window.innerWidth / 2, 80);
    this.itemSelectionUI.addChild(descriptionText);
    
    // Make sure availableItems is defined
    if (!this.availableItems) {
      this.availableItems = [ItemType.Platform, ItemType.Bomb, ItemType.Spikes];
    }
    
    // Create buttons for each item
    const itemNames = ["Platform", "Bomb", "Spikes"];
    const itemDescriptions = [
      "Add a 3-tile platform to help you reach the flag",
      "Remove a 3-tile platform (cannot remove flag platform)",
      "Place spikes on a platform to trap your opponent"
    ];
    
    for (let i = 0; i < this.availableItems.length; i++) {
      const button = new PIXI.Container();
      button.x = window.innerWidth / 2 - 250 + i * 250;
      button.y = 150;
      
      // Button background
      const bg = new PIXI.Graphics();
      bg.beginFill(0x333333);
      bg.lineStyle(2, 0x666666);
      bg.drawRoundedRect(0, 0, 200, 150, 10);
      bg.endFill();
      button.addChild(bg);
      
      // Item name
      const itemText = new PIXI.Text({
        text: itemNames[i],
        style: {
          fontFamily: "Arial",
          fontSize: 20,
          fill: 0xffffff,
          align: "center"
        }
      });
      itemText.anchor.set(0.5, 0);
      itemText.position.set(100, 20);
      button.addChild(itemText);
      
      // Item icon (placeholder graphics)
      const icon = new PIXI.Graphics();
      switch (this.availableItems[i]) {
        case ItemType.Platform:
          icon.beginFill(0x995533);
          icon.drawRect(50, 50, 100, 20);
          icon.endFill();
          break;
        case ItemType.Bomb:
          icon.beginFill(0x333333);
          icon.lineStyle(2, 0xff0000);
          icon.drawCircle(100, 60, 25);
          icon.endFill();
          break;
        case ItemType.Spikes:
          icon.beginFill(0xaaaaaa);
          for (let j = 0; j < 5; j++) {
            icon.moveTo(40 + j * 20, 70);
            icon.lineTo(50 + j * 20, 40);
            icon.lineTo(60 + j * 20, 70);
          }
          icon.endFill();
          break;
      }
      button.addChild(icon);
      
      // Item description
      const descText = new PIXI.Text({
        text: itemDescriptions[i],
        style: {
          fontFamily: "Arial",
          fontSize: 12,
          fill: 0xcccccc,
          align: "center",
          wordWrap: true,
          wordWrapWidth: 180
        }
      });
      descText.anchor.set(0.5, 0);
      descText.position.set(100, 100);
      button.addChild(descText);
      
      // Make interactive
      bg.eventMode = 'static';
      bg.cursor = 'pointer';
      bg.on('pointerdown', () => {
        this.selectPlayerItem(this.availableItems[i]);
      });
      
      this.itemSelectionUI.addChild(button);
      this.itemButtons.push(button);
    }
  }
  
  /**
   * Handle player item selection
   */
  selectPlayerItem(item: ItemType) {
    this.playerItem = item;
    
    // Update UI to show selection
    if (this.itemSelectionUI) {
      this.container.removeChild(this.itemSelectionUI);
      this.itemSelectionUI = null;
    }
    
    // Now let the AI choose an item using the behavior tree
    this.gameStage = 1;
    this.selectAIItem();
  }
  
  /**
   * AI selects an item using the behavior tree
   */
  selectAIItem() {
    if (!this.playerItem) {
      console.error("Player must select an item before AI");
      return;
    }
    
    // Get player position
    const playerPosition = new PIXI.Point(
      this.player.body.position.x / App.config.tileSize,
      this.player.body.position.y / App.config.tileSize
    );
    
    // Use adversary's behavior tree to select an item
    this.aiItem = this.adversary.selectItem(this.playerItem, playerPosition);
    
    // Create info text about AI's selection
    const aiSelectionText = new PIXI.Text({
      text: `AI selected: ${this.aiItem}`,
      style: {
        fontFamily: "Arial",
        fontSize: 24,
        fill: 0xffffff,
        align: "center"
      }
    });
    aiSelectionText.anchor.set(0.5);
    aiSelectionText.position.set(window.innerWidth / 2, window.innerHeight / 2 - 100);
    this.container.addChild(aiSelectionText);
    
    // Display for 2 seconds then move to item placement phase
    setTimeout(() => {
      this.container.removeChild(aiSelectionText);
      this.gameStage = 2;
      this.startItemPlacement();
    }, 2000);
  }
  
  /**
   * Start the item placement phase for the player
   */
  startItemPlacement() {
    if (!this.playerItem) return;
    
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
    placementText.position.set(window.innerWidth / 2, 50);
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
        } else if (this.itemPlacementPreview) {
          this.itemPlacementPreview.beginFill(0xff0000, 0.5);
          this.itemPlacementPreview.drawCircle(mouseX, mouseY, 20);
          this.itemPlacementPreview.endFill();
        }
        break;
        
      case ItemType.Spikes:
        this.itemPlacementPreview.beginFill(0xaaaaaa, 0.7);
        for (let i = 0; i < 3; i++) {
          this.itemPlacementPreview.moveTo(gridX + i * (App.config.tileSize/3), gridY + App.config.tileSize);
          this.itemPlacementPreview.lineTo(gridX + (i + 0.5) * (App.config.tileSize/3), gridY);
          this.itemPlacementPreview.lineTo(gridX + (i + 1) * (App.config.tileSize/3), gridY + App.config.tileSize);
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
        try {
          // Add a new platform (3 tiles wide)
          const platformRect = new PIXI.Rectangle(
            gridX, 
            gridY, 
            3, // width in tiles
            1  // height in tiles
          );
          console.log("Platform rectangle:", platformRect);
          
          const newPlatform = new Platform(platformRect);
          this.container.addChild(newPlatform.container);
          newPlatform.container.zIndex = 50;
          this.platforms.push(newPlatform);
          
          // Note: We don't need to add the physics body manually because
          // the Platform constructor already adds it to the physics world
          console.log("Platform created successfully");
        } catch (error) {
          console.error("Error creating platform:", error);
        }
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
              Matter.World.remove(App.physics.world, platform.body);
              this.container.removeChild(platform.container);
              this.platforms = this.platforms.filter(p => p !== platform);
            }
          });
        }
        break;
        
      case ItemType.Spikes:
        console.log("Creating spikes at", gridX, gridY);
        // Add spikes to a platform
        const spikesGraphics = new PIXI.Graphics();
        spikesGraphics.beginFill(0xaaaaaa);
        for (let i = 0; i < 3; i++) {
          spikesGraphics.moveTo(gridX * App.config.tileSize + i * (App.config.tileSize/3), 
                               gridY * App.config.tileSize + App.config.tileSize);
          spikesGraphics.lineTo(gridX * App.config.tileSize + (i + 0.5) * (App.config.tileSize/3), 
                               gridY * App.config.tileSize);
          spikesGraphics.lineTo(gridX * App.config.tileSize + (i + 1) * (App.config.tileSize/3), 
                               gridY * App.config.tileSize + App.config.tileSize);
        }
        spikesGraphics.endFill();
        this.container.addChild(spikesGraphics);
        spikesGraphics.zIndex = 60;
        
        // Store the spike location for collision detection
        this.spikeLocations.push({
          x: gridX * App.config.tileSize,
          y: gridY * App.config.tileSize,
          width: App.config.tileSize,
          height: App.config.tileSize
        });
        
        // Store the graphics object
        this.spikesGraphicsObjects.push(spikesGraphics);
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
    
    // Move to AI placement phase
    this.gameStage = 3;
    this.placeAIItem();
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
    const placementPosition = this.adversary.determineItemPlacement();
    const gridX = Math.floor(placementPosition.x);
    const gridY = Math.floor(placementPosition.y);
    
    // Wait a bit for dramatic effect, then place the item
    setTimeout(() => {
      switch (this.aiItem) {
        case ItemType.Platform:
          try {
            // Add a new platform (3 tiles wide)
            const platformRect = new PIXI.Rectangle(
              gridX, 
              gridY, 
              3, // width in tiles
              1  // height in tiles
            );
            console.log("AI Platform rectangle:", platformRect);
            
            const newPlatform = new Platform(platformRect);
            this.container.addChild(newPlatform.container);
            newPlatform.container.zIndex = 50;
            this.platforms.push(newPlatform);
            
            // Note: We don't need to add the physics body manually because
            // the Platform constructor already adds it to the physics world
            console.log("AI Platform created successfully");
          } catch (error) {
            console.error("Error creating AI platform:", error);
          }
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
            Matter.World.remove(App.physics.world, closestPlatform.body);
            this.container.removeChild(closestPlatform.container);
            this.platforms = this.platforms.filter(p => p !== closestPlatform);
          }
          break;
          
        case ItemType.Spikes:
          // Add spikes to a platform
          const spikesGraphics = new PIXI.Graphics();
          spikesGraphics.beginFill(0xaaaaaa);
          for (let i = 0; i < 3; i++) {
            spikesGraphics.moveTo(gridX * App.config.tileSize + i * (App.config.tileSize/3), 
                                 gridY * App.config.tileSize + App.config.tileSize);
            spikesGraphics.lineTo(gridX * App.config.tileSize + (i + 0.5) * (App.config.tileSize/3), 
                                 gridY * App.config.tileSize);
            spikesGraphics.lineTo(gridX * App.config.tileSize + (i + 1) * (App.config.tileSize/3), 
                                 gridY * App.config.tileSize + App.config.tileSize);
          }
          spikesGraphics.endFill();
          this.container.addChild(spikesGraphics);
          spikesGraphics.zIndex = 60;
          
          // Store the spike location for collision detection
          this.spikeLocations.push({
            x: gridX * App.config.tileSize,
            y: gridY * App.config.tileSize,
            width: App.config.tileSize,
            height: App.config.tileSize
          });
          
          // Store the graphics object
          this.spikesGraphicsObjects.push(spikesGraphics);
          break;
      }
      
      // Clean up and move to pathfinding phase
      this.container.removeChild(aiActionText);
      this.gameStage = 4;
      
      // Update the adversary's path based on the new level layout
      this.updateAdversaryPath();
      
      // Show message about AI pathfinding
      const pathfindText = new PIXI.Text({
        text: "AI is searching for a path to the flag...",
        style: {
          fontFamily: "Arial",
          fontSize: 24,
          fill: 0xffffff,
          align: "center"
        }
      });
      pathfindText.anchor.set(0.5);
      pathfindText.position.set(window.innerWidth / 2, 50);
      this.container.addChild(pathfindText);
      
      // Remove after 3 seconds
      setTimeout(() => {
        this.container.removeChild(pathfindText);
      }, 3000);
    }, 1500);
  }
  
  /**
   * Update the adversary's path after items are placed
   */
  updateAdversaryPath() {
    // Regenerate the level representation based on current platforms
    // This is a simplified approach - a more complete implementation would
    // update the level string representation based on all modifications
    
    // Recalculate the path
    const flagPosition = new PIXI.Point(
      this.flag.body.position.x / App.config.tileSize,
      this.flag.body.position.y / App.config.tileSize
    );
    
    const advStart = new PIXI.Point(
      this.adversary.body.position.x / App.config.tileSize,
      this.adversary.body.position.y / App.config.tileSize
    );
    
    this.adversary.calculatePath(advStart, flagPosition);
  }

  /**
   * Simple AABB collision detection
   */
  checkCollision(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
    return x1 < x2 + w2 &&
           x1 + w1 > x2 &&
           y1 < y2 + h2 &&
           y1 + h1 > y2;
  }
}

export const level = [
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

export const rlevel = [
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
  "                          F        ",
  "                        PPP        ",
  "                 P                 ",
  "PPPPP                              ",
  "                   P               ",
  "              P                    ",
  " X   P                             ",
  "PP   P   P  P                      ",
];

