import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { App } from '../system/App';
import { Node } from './node';
import { getLevelNodes, getNodeKey } from './preprocess';
import { level } from '../game/GameScene';

export class Adversary {
  container: PIXI.Container;
  sprite!: PIXI.Sprite;

  body!: Matter.Body;
  path: Node[] = [];
  currentPathIndex: number = 0;
  pathGraphics: PIXI.Graphics;
  moveTimer: number = 0;
  moveDelay: number = 30; // frames between moves
  reachedEnd: boolean = false;
  backgroundContainer: PIXI.Container;

  currentlyMoving: boolean = false;
  currentTarget: PIXI.Point = new PIXI.Point(0, 0);

  started: boolean = false;

  moving: boolean = false;
  canJump: boolean = false;
  jumpCooldown: boolean = false;
  contacts: Matter.Vector[] = [];


  constructor(start: PIXI.Point, target: PIXI.Point, backgroundContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    this.createSprite();
    this.createBody();

    this.backgroundContainer = backgroundContainer;
    this.pathGraphics = new PIXI.Graphics();
    backgroundContainer.addChild(this.pathGraphics);

    this.calculatePath(start, target);

  }
  
  createSprite() {
    this.sprite = App.sprite("scary");
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

  calculatePath(start: PIXI.Point, target: PIXI.Point) {
    const nodes = getLevelNodes(level);

    // Find the closest node to the start and target positions
    const startKey = getNodeKey(start.x, start.y);
    const targetKey = getNodeKey(target.x, target.y);

    const startNode = nodes.get(startKey);
    const targetNode = nodes.get(targetKey);

    if (!startNode || !targetNode) {
      console.error('Could not find start or target node');
      this.noPathFound();
      return;
    }

    // Perform A* search
    this.path = this.aStar(nodes, startNode, targetNode);

    if (this.path.length === 0) {
      console.error('No path found from', startKey, 'to', targetKey);
      this.noPathFound();
      return;
    }

    // Visualize the path
    this.visualizePath();
  }

  aStar(nodes: Map<string, Node>, start: Node, goal: Node): Node[] {
    // Reset all nodes
    for (const [_, node] of nodes) {
      node.visited = false;
      node.parent = null;
    }

    // Priority queue using array for simplicity (would use a proper heap in production)
    const openSet: Node[] = [start];
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const getKey = (node: Node) => getNodeKey(node.point.x, node.point.y);

    // Initialize scores
    for (const [_, node] of nodes) {
      gScore.set(getKey(node), Infinity);
      fScore.set(getKey(node), Infinity);
    }

    gScore.set(getKey(start), 0);
    fScore.set(getKey(start), this.heuristic(start, goal));

    while (openSet.length > 0) {
      // Find node with lowest fScore in openSet
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (fScore.get(getKey(openSet[i]))! < fScore.get(getKey(openSet[currentIndex]))!) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      if (getKey(current) === getKey(goal)) {
        // Reconstruct path
        return this.reconstructPath(current);
      }

      // Remove current from openSet
      openSet.splice(currentIndex, 1);
      current.visited = true;

      // Process neighbors
      for (const [neighborKey, weight] of current.neighbors) {
        const neighbor = nodes.get(neighborKey);
        if (!neighbor || neighbor.visited) continue;

        const tentativeGScore = gScore.get(getKey(current))! * weight;

        if (tentativeGScore < gScore.get(getKey(neighbor))!) {
          neighbor.parent = current;
          gScore.set(getKey(neighbor), tentativeGScore);
          fScore.set(getKey(neighbor), tentativeGScore + this.heuristic(neighbor, goal));

          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    console.error('No path found');
    return [];
  }

  heuristic(a: Node, b: Node): number {
    // Manhattan distance
    return Math.abs(a.point.x - b.point.x) + Math.abs(a.point.y - b.point.y);
  }

  reconstructPath(goal: Node): Node[] {
    const path: Node[] = [];
    let current: Node | null = goal;

    while (current) {
      path.unshift(current);
      current = current.parent;
    }

    return path;
  }

  visualizePath() {
    this.pathGraphics.clear();

    if (this.path.length < 2) return;

    // Draw dots at each node in the path
    for (const node of this.path) {
      this.pathGraphics.beginFill(0xff0000);
      this.pathGraphics.drawCircle(
        node.point.x * App.config.tileSize + App.config.tileSize / 2,
        node.point.y * App.config.tileSize + App.config.tileSize / 2,
        5
      );
      this.pathGraphics.endFill();
    }
  }

  get velocity() {
    // console.log(this.body.velocity);
    return this.body.velocity;
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
      this.sprite.texture = App.res("scary");

      this.jumpCooldown = true;
      setTimeout(() => this.jumpCooldown = false, 500);
    }
  }
  
  land(normal: Matter.Vector) {
    this.canJump = true;
    this.sprite.texture = App.sprite("scary").texture;
    this.contacts.push(normal);
    Matter.Body.setVelocity(this.body, {
      x: 0,
      y: this.velocity.y
    });
  }

  leftPlatform(normal: Matter.Vector) {
    const toRemoveIndex = this.contacts.findIndex((n) => n.x === normal.x && n.y === normal.y);
    this.contacts = this.contacts.filter((_, index) => index !== toRemoveIndex);

    if (this.contacts.length === 0) {
      this.canJump = false;
      this.sprite.texture = App.res("scary");
    }
  }

  update() {
    // A threshold for "close enough to the target."
    // Adjust based on tileSize, sprite size, etc.
    const threshold = 60;
    // 1. Calculate distance to currentTarget
    const dx = this.currentTarget.x - this.body.position.x;
    const dy = this.currentTarget.y - this.body.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < threshold) {
      // We arrived at the currentTarget
      this.currentlyMoving = false;
      console.log('Adversary reached the target point', this.currentTarget.x, this.currentTarget.y);
    }

  
    if (this.currentlyMoving) {
      // 2. Apply horizontal movement
      //    You can tweak "speedFactor" for how strong the horizontal force is
      const speedFactor = 0.02; 
      const xDir = (dx > 0) ? 1 : -1;
      this.move(xDir * speedFactor);

      // 3. Optionally decide when to jump
      //    For example, if the target is above us, or we need to climb onto a platform
      //    This is your game logic: maybe jump only if dy < some negative number?
      if (dy < -App.config.tileSize * 0.5 && this.canJump && !this.jumpCooldown) {
        this.jump();
      }
      // this.jump();
    } else {
      // 4. Pick the next path node if there is one
      if (this.path.length > 0 && this.currentPathIndex < this.path.length && !this.reachedEnd) {
        const targetNode = this.path[this.currentPathIndex];
        const targetX = targetNode.point.x * App.config.tileSize + App.config.tileSize / 2;
        const targetY = targetNode.point.y * App.config.tileSize + App.config.tileSize / 2;
  
        // Assign currentTarget and mark that we are moving
        this.currentlyMoving = true;
        this.currentTarget = new PIXI.Point(targetX, targetY); 
  
        // Move to the next point in the path
        this.currentPathIndex++;
  
        // Check if we've reached the end of the path
        if (this.currentPathIndex >= this.path.length) {
          this.reachedEnd = true;
          console.log('Adversary reached the flag!');
        }
      }
    }
  
    // If not started yet, you can do a spawn teleport or skip if you want purely physics-based
    if (!this.started && this.currentTarget.x !== 0.0) { 
      Matter.Body.setPosition(this.body, {
        x: this.currentTarget.x,
        y: this.currentTarget.y
      });
      this.started = true;
    }
  
    // Keep sprite's position synced with physics body
    this.sprite.position = this.body.position;
  }
  

  // update() {
  //   const threshold = 30; // <--- Tweak this “arrival threshold” as needed
 
  //   if (this.currentlyMoving) {
  //     console.log('Adversary is moving to target point', this.currentTarget.x, this.currentTarget.y);
  //     const distance = Math.hypot(this.currentTarget.x - this.body.position.x, this.currentTarget.y - this.body.position.y);
  //     if (distance < threshold) {
  //       this.currentlyMoving = false;
  //       console.log('Adversary reached the target point', this.currentTarget.x, this.currentTarget.y);
  //       console.log('Adversary position:', this.body.position.x, this.body.position.y);
  //     } else { 

  //       let speed = .02;
  //       const direction = this.currentTarget.x - this.body.position.x;
  //       if (direction < 0) {
  //         speed = -.02;  
  //       }
  //       this.jump();
        
  //       this.move(speed);
  //       // Rotate the sprite to face the direction of movement
  //       // this.sprite.rotation = angle;
  //     }
  //   } else {
  //     // Move along the path
  //     if (this.path.length > 0 && this.currentPathIndex < this.path.length && !this.reachedEnd) {
  //       const targetNode = this.path[this.currentPathIndex];
  //       const targetX = targetNode.point.x * App.config.tileSize + App.config.tileSize / 2;
  //       const targetY = targetNode.point.y * App.config.tileSize + App.config.tileSize / 2;

  //       this.currentlyMoving = true;
  //       this.currentTarget = new PIXI.Point(targetX, targetY);

  //       // Move to the next point in the path
  //       this.currentPathIndex++;

  //       // Check if we've reached the end
  //       if (this.currentPathIndex >= this.path.length) {
  //         this.reachedEnd = true;
  //         console.log('Adversary reached the flag!');
  //       }
  //     }
  //   }

  //   if (!this.started && this.currentTarget.x !== 0.0) { 
  //     Matter.Body.setPosition(this.body, { x: this.currentTarget.x, y: this.currentTarget.y });
  //     this.started = true;
  // }

  //   // Update the sprite position to match the physics body
  //   this.sprite.position = this.body.position;
  // }

  destroy() {
    Matter.Composite.remove(App.physics.world, this.body);
    this.container.removeChild(this.sprite);
    this.pathGraphics.clear();
  }

  noPathFound() {
    // Mark that we've reached the end so the player can start
    this.reachedEnd = true;

    // Create a visual indicator that no path was found
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(4, 0xff0000);

    // Draw an X where the adversary is
    const x = this.body.position.x;
    const y = this.body.position.y;
    const size = App.config.tileSize;

    this.pathGraphics.moveTo(x - size / 2, y - size / 2);
    this.pathGraphics.lineTo(x + size / 2, y + size / 2);
    this.pathGraphics.moveTo(x + size / 2, y - size / 2);
    this.pathGraphics.lineTo(x - size / 2, y + size / 2);
  }
} 
