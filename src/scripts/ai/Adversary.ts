import * as PIXI from "pixi.js";
import Matter from "matter-js";
import { App } from "../system/App";
import { Node } from "./node";
import { estimateArc, estimateArcInverse, getLevelNodes, getNodeKey } from "./preprocess";

export class Adversary {
  container: PIXI.Container;
  sprite!: PIXI.Sprite;

  body!: Matter.Body;
  path: Node[] = [];
  currentPathIndex: number = 0;
  pathGraphics: PIXI.Graphics;
  moveDelay: number = 500; // milliseconds 
  reachedEnd: boolean = false;
  backgroundContainer: PIXI.Container;

  currentTarget?: PIXI.Point | null;
  canJump: boolean = false;
  moving: boolean = false;


  constructor(
    start: PIXI.Point,
    backgroundContainer: PIXI.Container,
  ) {
    this.container = new PIXI.Container();

    this.createSprite();
    this.createBody();

    this.backgroundContainer = backgroundContainer;
    this.pathGraphics = new PIXI.Graphics();
    backgroundContainer.addChild(this.pathGraphics);


    Matter.Body.setPosition(this.body, {
      x: start.x * App.config.tileSize + App.config.tileSize / 2,
      y: start.y * App.config.tileSize + App.config.tileSize / 2,
    });
  }

  createSprite() {
    this.sprite = App.sprite("scary");
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
      }
    );

    Matter.World.add(App.physics.world, this.body);
  }

  calculatePath(start: PIXI.Point, target: PIXI.Point, levelState: string[]) {
    const nodes = getLevelNodes(levelState);

    // Find the closest node to the start and target positions
    const startKey = getNodeKey(start.x, start.y);
    const targetKey = getNodeKey(target.x, target.y);

    const startNode = nodes.get(startKey);
    const targetNode = nodes.get(targetKey);

    if (!startNode || !targetNode) {
      console.error("Could not find start or target node");
      this.noPathFound();
      return;
    }

    // Perform A* search
    this.path = this.aStar(nodes, startNode, targetNode);

    if (this.path.length === 0) {
      console.error("No path found from", startKey, "to", targetKey);
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
        if (
          fScore.get(getKey(openSet[i]))! <
          fScore.get(getKey(openSet[currentIndex]))!
        ) {
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

        const tentativeGScore = gScore.get(getKey(current))! + weight;

        if (tentativeGScore < gScore.get(getKey(neighbor))!) {
          neighbor.parent = current;
          gScore.set(getKey(neighbor), tentativeGScore);
          fScore.set(
            getKey(neighbor),
            tentativeGScore + this.heuristic(neighbor, goal)
          );

          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    console.error("No path found");
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

    let c = 0;
    // Draw dots at each node in the path
    let prevNode;
    for (const node of this.path) {
      // dots
      this.pathGraphics.beginFill(0xFFFF00);
      this.pathGraphics.drawCircle(
        node.point.x * App.config.tileSize + App.config.tileSize / 2,
        node.point.y * App.config.tileSize + App.config.tileSize / 2,
        5
      );
      this.pathGraphics.endFill();


      if (!prevNode) {
        prevNode = node;
        continue;
      }

      if (prevNode.point.y === node.point.y && Math.abs(prevNode.point.x - node.point.x) === 1) {
        // horizontal line
        this.pathGraphics.moveTo(prevNode.point.x * App.config.tileSize + App.config.tileSize / 2,
          prevNode.point.y * App.config.tileSize + App.config.tileSize / 2);
        this.pathGraphics.lineTo(node.point.x * App.config.tileSize + App.config.tileSize / 2,
          node.point.y * App.config.tileSize + App.config.tileSize / 2);
        this.pathGraphics.stroke({ color: 0xFFFF00, pixelLine: true });
      } else {
        // draw estimated jump arc
        this.pathGraphics.moveTo(node.point.x * App.config.tileSize + App.config.tileSize / 2,
          node.point.y * App.config.tileSize + App.config.tileSize / 2);
        let prevX = node.point.x;
        let prevY = node.point.y;
        for (let x = 1; x <= 10; x++) {
          const step = node.point.x + x * (prevNode.point.x - node.point.x) / 10;
          const y = estimateArc(
            step,
            prevNode.point.x,
            prevNode.point.y,
            node.point.x,
            node.point.y,
          );

          this.pathGraphics.lineTo(step * App.config.tileSize + App.config.tileSize / 2,
            y * App.config.tileSize + App.config.tileSize / 2);
          this.pathGraphics.stroke({ color: 0xFFFF00, pixelLine: true });
          prevX = step;
          prevY = y;
        }
      }

      prevNode = node;
      c++;
    }
  }

  get velocity() {
    // console.log(this.body.velocity);
    return this.body.velocity;
  }

  goToFlag(start: PIXI.Point, target: PIXI.Point, levelState: string[]) {
    this.calculatePath(start, target, levelState);

    if (this.path.length < 2) {
      this.noPathFound();
      return;
    }

    console.log("Path found from", start, "to", target, ":", this.path);

    this.reachedEnd = false;

    // set the current target to the first node in the path
    this.currentTarget = new PIXI.Point(
      this.path[1].point.x * App.config.tileSize + App.config.tileSize / 2,
      this.path[1].point.y * App.config.tileSize + App.config.tileSize / 2
    );
    this.currentPathIndex = 1;

    Matter.Body.setPosition(this.body, {
      x: this.path[0].point.x * App.config.tileSize + App.config.tileSize / 2,
      y: this.path[0].point.y * App.config.tileSize + App.config.tileSize / 2
    });

    this.canJump = true;
    this.moving = false;
  }

  moveTowardsTarget() {
    if (!this.currentTarget) return;

    const targetNode = this.path[this.currentPathIndex].point;
    const previousNode = this.path[this.currentPathIndex - 1].point;

    const direction = targetNode.x - previousNode.x;
    if (targetNode.y === previousNode.y && Math.abs(direction) === 1) {
      this.walk(direction);
    } else {
      this.jump(targetNode, previousNode);
    }
  }

  walk(xDir: number) {
    if (this.atTarget()) {
      this.nextTarget();
      return;
    }

    Matter.Body.applyForce(this.body, this.body.position, {
      x: xDir * App.config.playerSpeed,
      y: 0
    });

    this.moving = true;
  }

  jump(targetNode: PIXI.Point, previousNode: PIXI.Point) {
    const currentTileY = this.body.position.y / App.config.tileSize;
    // instant call (once not looped)
    if (this.canJump) {
      // set velocity to zero for consistent jumping
      Matter.Body.setVelocity(this.body, {
        x: 0,
        y: 0,
      });

      // apply jump force
      Matter.Body.applyForce(this.body, this.body.position, {
        x: 0,
        y: -App.config.playerJump
      });
      this.canJump = false;

      this.moving = true;

      this.body.isSensor = true;
    }

    // looped call every tick we are moving
    if (this.moving) {
      const x = estimateArcInverse(
        currentTileY - 0.5,
        this.body.velocity.y,
        previousNode.x,
        previousNode.y,
        targetNode.x,
        targetNode.y,
      );

      if (Number.isNaN(x)) {
        this.moving = false;
        return;
      }

      Matter.Body.setPosition(this.body, {
        x: (x + previousNode.x) * App.config.tileSize + App.config.tileSize / 2,
        y: this.body.position.y
      });

    }
  }


  land() {
    if (!this.atTarget()) return;

    this.nextTarget();

    setTimeout(() => {
      this.canJump = true;
    }, this.moveDelay);
    this.moving = false;
  }

  atTarget() {
    return this.currentTarget &&
      Math.abs(this.currentTarget.x - this.body.position.x) < 5 &&
      Math.abs(this.currentTarget.y - this.body.position.y) < 20;
  }

  nextTarget() {
    console.log('Reached target', this.path[this.currentPathIndex].point);
    this.currentPathIndex++;
    this.currentTarget = new PIXI.Point(
      this.path[this.currentPathIndex].point.x * App.config.tileSize + App.config.tileSize / 2,
      this.path[this.currentPathIndex].point.y * App.config.tileSize + App.config.tileSize / 2
    );

    this.moving = false;
  }

  update() {
    if (this.currentTarget) {
      // check if the path is finished
      if (this.reachedEnd && this.currentTarget !== null) {
        this.pathGraphics.clear();
        this.currentTarget = null;
        return;
      }

      if (this.atTarget()) {
        this.body.isSensor = false;
      }

      // if we've not reached the end, move towards the target
      this.moveTowardsTarget();
    }
    // Keep sprite's position synced with physics body
    this.sprite.position = this.body.position;
  }

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
