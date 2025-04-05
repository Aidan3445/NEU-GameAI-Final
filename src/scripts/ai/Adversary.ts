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

  constructor(start: PIXI.Point, target: PIXI.Point, backgroundContainer: PIXI.Container) {
    this.container = new PIXI.Container();
    this.sprite = App.sprite('player');
    this.sprite.scale.set(App.config.playerScale * 0.25);
    this.sprite.anchor.set(0.5);
    this.sprite.tint = 0xff0000; // Red tint
    this.container.addChild(this.sprite);

    this.body = Matter.Bodies.circle(
      start.x * App.config.tileSize + App.config.tileSize / 2,
      start.y * App.config.tileSize + App.config.tileSize / 2,
      App.config.tileSize * App.config.playerScale / 8,
      { 
        friction: 0,
        frictionAir: 0,
        restitution: 0,
        inertia: Infinity,
        isStatic: true // Make it static so it doesn't collide with physics
      }
    );

    Matter.Composite.add(App.physics.world, this.body);

    // Create path graphics for visualizing the path
    this.pathGraphics = new PIXI.Graphics();
    backgroundContainer.addChild(this.pathGraphics);

    // Calculate the path from start to target
    this.calculatePath(start, target);
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
        
        const tentativeGScore = gScore.get(getKey(current))! + weight;
        
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
  
  update() {
    // Move along the path
    if (this.path.length > 0 && this.currentPathIndex < this.path.length && !this.reachedEnd) {
      // Only move after the delay
      this.moveTimer++;
      if (this.moveTimer >= this.moveDelay) {
        const targetNode = this.path[this.currentPathIndex];
        const targetX = targetNode.point.x * App.config.tileSize + App.config.tileSize / 2;
        const targetY = targetNode.point.y * App.config.tileSize + App.config.tileSize / 2;
        
        // Move the body to the next position in the path
        Matter.Body.setPosition(this.body, { x: targetX, y: targetY });
        
        // Move to the next point in the path
        this.currentPathIndex++;
        this.moveTimer = 0;
        
        // Check if we've reached the end
        if (this.currentPathIndex >= this.path.length) {
          this.reachedEnd = true;
          console.log('Adversary reached the flag!');
        }
      }
    }
    
    // Update the sprite position to match the physics body
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
    
    this.pathGraphics.moveTo(x - size/2, y - size/2);
    this.pathGraphics.lineTo(x + size/2, y + size/2);
    this.pathGraphics.moveTo(x + size/2, y - size/2);
    this.pathGraphics.lineTo(x - size/2, y + size/2);
  }
} 