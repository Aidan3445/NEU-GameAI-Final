import * as PIXI from "pixi.js";
import { App } from "../system/App";
import Matter from "matter-js";
import { Player } from "../game/Player";
import { getLevelNodes, getNodeKey } from "./preprocess";
import { Node } from "./node";

export class AIPlayer extends Player {
  path: PIXI.Point[] = [];
  currentPathIndex: number = 0;
  targetNode: Node | null = null;
  pathGraphics: PIXI.Graphics = new PIXI.Graphics();
  movementCooldown: number = 0;
  isActive: boolean = false;
  reachedFlag: boolean = false;
  onReachDestination: (() => void) | null = null;
  stuckCounter: number = 0;
  lastPosition: PIXI.Point = new PIXI.Point(0, 0);
  stuckThreshold: number = 60; // ~1 second at 60fps
  // Track oscillation (moving back and forth)
  lastDirection: number = 0;
  directionChanges: number = 0;
  waypointReachedMarkers: PIXI.Graphics[] = [];
  // Debugging
  debugText: PIXI.Text;
  debugGraphics: PIXI.Graphics = new PIXI.Graphics();
  platformDetectionRange: number = 2 * App.config.tileSize;
  waitBeforeJump: number = 0;
  // Platform detection
  platformTargetPoints: PIXI.Point[] = [];
  platformsUnderPath: PIXI.Rectangle[] = [];
  platformSearchWidth: number = App.config.tileSize * 5;
  platformSearchHeight: number = App.config.tileSize * 8;

  constructor(backgroundContainer: PIXI.Container) {
    super(backgroundContainer);
    this.backgroundContainer.addChild(this.pathGraphics);
    this.backgroundContainer.addChild(this.debugGraphics);
    
    // Create debug text
    this.debugText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontSize: 12,
        fill: 0xffffff,
        align: "center",
      },
    });
    this.debugText.anchor.set(0.5, 0);
    this.sprite.addChild(this.debugText);
  }

  // Find path using Dijkstra's algorithm
  findPath(levelPlan: string[], startPoint: PIXI.Point, endPoint: PIXI.Point) {
    // Clear any existing path and reset state
    this.clearPath();
    
    console.log(`Finding path from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y})`);
    
    // Start by finding platforms in the level that can be used as waypoints
    this.findPlatformsUnderPath(levelPlan, startPoint, endPoint);
    
    // If we found platforms, create a path through them
    if (this.platformTargetPoints.length > 0) {
      this.createPlatformBasedPath(startPoint, endPoint);
      return;
    }
    
    // Get all traversable nodes
    const nodes = getLevelNodes(levelPlan);
    
    // Get start and end nodes
    const startNodeKey = getNodeKey(
      Math.floor(startPoint.x / App.config.tileSize),
      Math.floor(startPoint.y / App.config.tileSize)
    );
    
    const endNodeKey = getNodeKey(
      Math.floor(endPoint.x / App.config.tileSize),
      Math.floor(endPoint.y / App.config.tileSize)
    );
    
    console.log("Finding path from", startNodeKey, "to", endNodeKey);
    
    // If start or end nodes don't exist, we can't find a path
    const startNode = nodes.get(startNodeKey);
    const endNode = nodes.get(endNodeKey);
    if (!startNode || !endNode) {
      console.error("Start or end node not found", startNodeKey, endNodeKey);
      console.log("Start point:", startPoint.x, startPoint.y);
      console.log("End point:", endPoint.x, endPoint.y);
      
      // Try finding nearest nodes if exact ones don't exist
      const alternativeStartNode = this.findNearestNode(nodes, startPoint);
      const alternativeEndNode = this.findNearestNode(nodes, endPoint);
      
      if (alternativeStartNode && alternativeEndNode) {
        console.log("Using alternative start/end nodes");
        this.findPathBetweenNodes(nodes, alternativeStartNode, alternativeEndNode);
        return;
      }
      
      // If we still can't find nodes, create a direct path
      this.createDirectPath(startPoint, endPoint);
      return;
    }
    
    this.findPathBetweenNodes(nodes, startNode, endNode);
  }
  
  // Find platforms under the path from start to end
  findPlatformsUnderPath(levelPlan: string[], startPoint: PIXI.Point, endPoint: PIXI.Point) {
    console.log("Finding platforms under path");
    
    // Reset platform target points
    this.platformTargetPoints = [];
    this.platformsUnderPath = [];
    
    // Calculate direct path parameters
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If end is higher than start (need to climb), look for platforms
    if (endPoint.y < startPoint.y) {
      // Get all platforms from the level
      const levelWidth = levelPlan[0].length;
      const levelHeight = levelPlan.length;
      const platforms: PIXI.Rectangle[] = [];
      
      // Find all platforms in the level (marked as 'P' in level plan)
      for (let y = 0; y < levelHeight; y++) {
        let platformStart = -1;
        
        for (let x = 0; x < levelWidth; x++) {
          const tile = levelPlan[y][x];
          
          if (tile === 'P' && platformStart === -1) {
            platformStart = x;
          } else if (tile !== 'P' && platformStart !== -1) {
            // Found end of platform
            platforms.push(new PIXI.Rectangle(
              platformStart * App.config.tileSize,
              y * App.config.tileSize,
              (x - platformStart) * App.config.tileSize,
              App.config.tileSize
            ));
            platformStart = -1;
          }
        }
        
        // Handle platform at edge of level
        if (platformStart !== -1) {
          platforms.push(new PIXI.Rectangle(
            platformStart * App.config.tileSize,
            y * App.config.tileSize,
            (levelWidth - platformStart) * App.config.tileSize,
            App.config.tileSize
          ));
        }
      }
      
      console.log(`Found ${platforms.length} platforms in level`);
      
      // Sample points along the path and look for platforms below
      const numSamples = Math.max(5, Math.ceil(distance / (App.config.tileSize * 3)));
      const usedPlatforms = new Set<number>();
      
      for (let i = 1; i < numSamples; i++) {
        const t = i / numSamples;
        const pointX = startPoint.x + dx * t;
        const pointY = startPoint.y + dy * t;
        
        // Search region below this point
        const searchRegion = new PIXI.Rectangle(
          pointX - this.platformSearchWidth / 2,
          pointY,
          this.platformSearchWidth,
          this.platformSearchHeight
        );
        
        // Find platforms within search region
        let bestPlatform = null;
        let bestDistance = Number.MAX_VALUE;
        let bestIndex = -1;
        
        for (let j = 0; j < platforms.length; j++) {
          const platform = platforms[j];
          
          // Skip already used platforms
          if (usedPlatforms.has(j)) continue;
          
          // Check if platform's top edge is below the point
          if (platform.y > pointY) {
            // Check if platform is horizontally aligned with search region
            const platformMiddle = platform.x + platform.width / 2;
            if (platformMiddle >= searchRegion.x && platformMiddle <= searchRegion.x + searchRegion.width) {
              // Calculate vertical distance
              const verticalDist = platform.y - pointY;
              
              // Keep the closest platform that's not too far
              if (verticalDist < bestDistance && verticalDist < this.platformSearchHeight) {
                bestDistance = verticalDist;
                bestPlatform = platform;
                bestIndex = j;
              }
            }
          }
        }
        
        // If found a suitable platform, add it to our target points
        if (bestPlatform && bestIndex >= -1) {
          usedPlatforms.add(bestIndex);
          this.platformsUnderPath.push(bestPlatform);
          
          // Create target point above the platform
          const targetPoint = new PIXI.Point(
            bestPlatform.x + bestPlatform.width / 2,  // Target middle of platform
            bestPlatform.y - App.config.tileSize/2    // Target just above platform
          );
          
          this.platformTargetPoints.push(targetPoint);
          console.log(`Added platform target at (${targetPoint.x}, ${targetPoint.y})`);
        }
      }
    }
  }
  
  // Create a path based on platforms
  createPlatformBasedPath(startPoint: PIXI.Point, endPoint: PIXI.Point) {
    console.log("Creating platform-based path");
    
    // Clear existing path
    this.path = [];
    this.currentPathIndex = 0;
    
    // Always start with the starting point
    this.path.push(new PIXI.Point(startPoint.x, startPoint.y));
    
    // Add all platform target points as waypoints
    this.platformTargetPoints.forEach(target => {
      this.path.push(new PIXI.Point(target.x, target.y));
    });
    
    // End with the destination point
    this.path.push(new PIXI.Point(endPoint.x, endPoint.y));
    
    // Visualize the path
    this.visualizePath();
    this.visualizePlatforms();
  }
  
  // Visualize the platforms under the path
  visualizePlatforms() {
    // Clear existing debug graphics
    this.debugGraphics.clear();
    
    // Draw each platform with a highlight
    this.platformsUnderPath.forEach(platform => {
      this.debugGraphics.lineStyle(2, 0x00ffff);
      this.debugGraphics.drawRect(
        platform.x, platform.y,
        platform.width, platform.height
      );
    });
  }
  
  // Find nearest valid node to a point
  findNearestNode(nodes: Map<string, Node>, point: PIXI.Point): Node | null {
    const gridX = Math.floor(point.x / App.config.tileSize);
    const gridY = Math.floor(point.y / App.config.tileSize);
    
    // Search in increasing radius
    for (let radius = 1; radius <= 15; radius++) { // Increased search radius further
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) { // Only check perimeter
            const checkX = gridX + dx;
            const checkY = gridY + dy;
            
            if (checkX < 0 || checkY < 0) continue; // Skip invalid coordinates
            
            const node = nodes.get(getNodeKey(checkX, checkY));
            if (node) {
              console.log(`Found nearest node at (${checkX}, ${checkY}) for point (${gridX}, ${gridY})`);
              return node;
            }
          }
        }
      }
    }
    
    return null;
  }
  
  // Create a direct path when pathfinding fails
  createDirectPath(startPoint: PIXI.Point, endPoint: PIXI.Point) {
    console.log("Creating direct path between points");
    
    // Clear existing path
    this.path = [];
    this.currentPathIndex = 0;
    
    // Add some intermediate points to help with navigation
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // For short distances, just go direct
    if (distance < App.config.tileSize * 10) {
      this.path = [
        new PIXI.Point(startPoint.x, startPoint.y),
        new PIXI.Point(endPoint.x, endPoint.y)
      ];
    } else {
      // For longer distances, create some intermediate waypoints
      const numWaypoints = Math.ceil(distance / (App.config.tileSize * 5));
      
      this.path.push(new PIXI.Point(startPoint.x, startPoint.y));
      
      for (let i = 1; i < numWaypoints; i++) {
        const t = i / numWaypoints;
        const x = startPoint.x + dx * t;
        const y = startPoint.y + dy * t;
        this.path.push(new PIXI.Point(x, y));
      }
      
      this.path.push(new PIXI.Point(endPoint.x, endPoint.y));
    }
    
    this.visualizePath();
  }
  
  // Find path between two nodes
  findPathBetweenNodes(nodes: Map<string, Node>, startNode: Node, endNode: Node) {
    // Reset all nodes for pathfinding
    for (const [_, node] of nodes) {
      node.visited = false;
      node.parent = null;
    }
    
    // Dijkstra's algorithm
    const distances: Map<string, number> = new Map();
    const previous: Map<string, Node | null> = new Map();
    const unvisited: Set<string> = new Set();
    
    // Initialize distances
    for (const [key, _] of nodes) {
      distances.set(key, Infinity);
      previous.set(key, null);
      unvisited.add(key);
    }
    
    const startNodeKey = getNodeKey(startNode.point.x, startNode.point.y);
    const endNodeKey = getNodeKey(endNode.point.x, endNode.point.y);
    
    distances.set(startNodeKey, 0);
    
    while (unvisited.size > 0) {
      // Find the unvisited node with minimum distance
      let currentKey: string | null = null;
      let minDistance = Infinity;
      
      for (const key of unvisited) {
        const distance = distances.get(key) || Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          currentKey = key;
        }
      }
      
      // If we can't find a node or the min distance is infinity, 
      // then remaining nodes are unreachable
      if (currentKey === null || minDistance === Infinity) {
        break;
      }
      
      // If we reached the target, reconstruct the path
      if (currentKey === endNodeKey) {
        let current = endNode;
        const path: Node[] = [current];
        
        while (currentKey !== startNodeKey) {
          current = previous.get(currentKey)!;
          if (!current) break; // Safety check
          path.unshift(current);
          currentKey = getNodeKey(current.point.x, current.point.y);
        }
        
        this.reconstructPath(path);
        this.visualizePath();
        return;
      }
      
      // Remove from unvisited
      unvisited.delete(currentKey);
      
      // Update distances to neighbors
      const currentNode = nodes.get(currentKey)!;
      for (const [neighborKey, weight] of currentNode.getNeighbors()) {
        if (!unvisited.has(neighborKey)) continue;
        
        const alt = (distances.get(currentKey) || 0) + weight;
        const currentDistance = distances.get(neighborKey) || Infinity;
        
        if (alt < currentDistance) {
          distances.set(neighborKey, alt);
          previous.set(neighborKey, currentNode);
        }
      }
    }
    
    console.error("No path found between nodes");
    
    // If no path found but we have a target destination, create a direct path
    this.createDirectPath(
      new PIXI.Point(
        startNode.point.x * App.config.tileSize + App.config.tileSize / 2,
        startNode.point.y * App.config.tileSize + App.config.tileSize / 2
      ),
      new PIXI.Point(
        endNode.point.x * App.config.tileSize + App.config.tileSize / 2,
        endNode.point.y * App.config.tileSize + App.config.tileSize / 2
      )
    );
  }
  
  // Reconstruct path from nodes
  reconstructPath(nodePath: Node[]) {
    if (nodePath.length === 0) {
      console.error("Empty node path in reconstructPath");
      return;
    }
    
    this.path = nodePath.map(node => new PIXI.Point(
      node.point.x * App.config.tileSize + App.config.tileSize / 2,
      node.point.y * App.config.tileSize + App.config.tileSize / 2
    ));
    
    // Ensure there are no duplicate waypoints right next to each other
    this.path = this.path.filter((point, index, array) => {
      if (index === 0) return true;
      
      const prevPoint = array[index - 1];
      const dx = Math.abs(point.x - prevPoint.x);
      const dy = Math.abs(point.y - prevPoint.y);
      
      // Keep points that are at least a certain distance apart
      return dx > 1 || dy > 1;
    });
    
    console.log(`Reconstructed path with ${this.path.length} waypoints`);
  }
  
  // Visualize the path for debugging
  visualizePath() {
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(3, 0xff0000); // Changed to red for better visibility
    
    // Clear any existing waypoint markers
    this.clearWaypointMarkers();
    
    if (this.path.length > 0) {
      this.pathGraphics.moveTo(this.path[0].x, this.path[0].y);
      
      // Draw first waypoint as a circle
      this.drawWaypointMarker(this.path[0], 0x00ffff);
      
      for (let i = 1; i < this.path.length; i++) {
        this.pathGraphics.lineTo(this.path[i].x, this.path[i].y);
        
        // Draw waypoint as a circle
        this.drawWaypointMarker(this.path[i], i === this.path.length - 1 ? 0xff0000 : 0x00ffff);
      }
    }
  }
  
  // Draw a waypoint marker
  drawWaypointMarker(position: PIXI.Point, color: number) {
    const marker = new PIXI.Graphics();
    marker.circle(position.x, position.y, 5);
    marker.fill(color);
    marker.zIndex = 1000;
    this.backgroundContainer.addChild(marker);
    this.waypointReachedMarkers.push(marker);
    
    // Add waypoint number
    const text = new PIXI.Text({
      text: this.waypointReachedMarkers.length - 1,
      style: {
        fontFamily: "Arial",
        fontSize: 12,
        fill: 0xffffff,
      }
    });
    text.anchor.set(0.5);
    text.position.set(position.x, position.y - 15);
    marker.addChild(text);
  }
  
  // Clear waypoint markers
  clearWaypointMarkers() {
    for (const marker of this.waypointReachedMarkers) {
      this.backgroundContainer.removeChild(marker);
      marker.destroy();
    }
    this.waypointReachedMarkers = [];
  }
  
  // Clear the current path
  clearPath() {
    this.path = [];
    this.currentPathIndex = 0;
    this.pathGraphics.clear();
    this.clearWaypointMarkers();
    this.directionChanges = 0;
    this.lastDirection = 0;
    this.debugGraphics.clear();
    this.platformTargetPoints = [];
    this.platformsUnderPath = [];
  }
  
  // Check if AI is stuck and handle it
  checkIfStuck() {
    const currentPos = new PIXI.Point(this.body.position.x, this.body.position.y);
    const distance = Math.sqrt(
      Math.pow(currentPos.x - this.lastPosition.x, 2) + 
      Math.pow(currentPos.y - this.lastPosition.y, 2)
    );
    
    // If we haven't moved much
    if (distance < 1) {
      this.stuckCounter++;
      
      // If stuck for too long
      if (this.stuckCounter > this.stuckThreshold) {
        console.log("AI appears to be stuck, trying to recover");
        
        // Try jumping if possible
        if (this.canJump) {
          this.jump();
        } else {
          // Try moving in a different direction
          if (this.lastDirection !== 0) {
            this.move(-this.lastDirection);
            setTimeout(() => {
              if (this.canJump) {
                this.jump();
              }
            }, 100);
          }
        }
        
        // Skip to the next waypoint if we've been stuck too long
        if (this.stuckCounter > this.stuckThreshold * 3 && this.currentPathIndex < this.path.length - 1) {
          this.currentPathIndex++;
          console.log("Skipping to next waypoint:", this.currentPathIndex);
          
          // Mark the current waypoint as red (skipped)
          if (this.currentPathIndex < this.waypointReachedMarkers.length) {
            this.waypointReachedMarkers[this.currentPathIndex].clear();
            this.waypointReachedMarkers[this.currentPathIndex].circle(
              this.path[this.currentPathIndex].x, 
              this.path[this.currentPathIndex].y, 
              5
            );
            this.waypointReachedMarkers[this.currentPathIndex].fill(0xff0000);
          }
        }
        
        // Reset counter
        this.stuckCounter = 0;
      }
    } else {
      // Reset counter if we're moving
      this.stuckCounter = 0;
    }
    
    // Check for oscillation (rapid direction changes)
    if (this.lastDirection !== 0) {
      const currentDirection = Math.sign(currentPos.x - this.lastPosition.x);
      
      if (currentDirection !== 0 && currentDirection !== this.lastDirection) {
        this.directionChanges++;
        
        // If we've changed direction too many times, skip to next waypoint
        if (this.directionChanges > 10 && this.currentPathIndex < this.path.length - 1) {
          console.log("Detected oscillation, skipping waypoint");
          this.currentPathIndex++;
          this.directionChanges = 0;
        }
      }
      
      this.lastDirection = currentDirection !== 0 ? currentDirection : this.lastDirection;
    }
    
    // Update last position
    this.lastPosition.x = currentPos.x;
    this.lastPosition.y = currentPos.y;
  }

  // Check if there's a platform below and to the sides
  detectPlatforms() {
    this.debugGraphics.clear();
    
    // Get current and next waypoints for context
    const currentTarget = this.currentPathIndex < this.path.length ? 
      this.path[this.currentPathIndex] : null;
    
    // Calculate detection area based on current position and next waypoint
    let detectionWidth = this.platformSearchWidth;
    let detectionHeight = this.platformSearchHeight;
    let offsetX = 0;
    
    // If we have a current target, adjust detection area to favor that direction
    if (currentTarget) {
      const dx = currentTarget.x - this.body.position.x;
      // Shift detection area in the direction of the target
      offsetX = Math.sign(dx) * App.config.tileSize;
      
      // If target is above us, look for platforms we can jump to
      if (currentTarget.y < this.body.position.y) {
        detectionHeight = Math.min(this.platformSearchHeight, 
                                 this.body.position.y - currentTarget.y + App.config.tileSize * 3);
      }
    }
    
    // Draw detection area
    this.debugGraphics.lineStyle(1, 0xffff00);
    this.debugGraphics.drawRect(
      this.body.position.x - detectionWidth/2 + offsetX,
      this.body.position.y,
      detectionWidth,
      detectionHeight
    );
    
    // Use Matter.js to detect platforms in this area
    const bodies = Matter.Query.region(
      Matter.Composite.allBodies(App.physics.world),
      {
        min: { 
          x: this.body.position.x - detectionWidth/2 + offsetX, 
          y: this.body.position.y 
        },
        max: { 
          x: this.body.position.x + detectionWidth/2 + offsetX, 
          y: this.body.position.y + detectionHeight 
        }
      }
    );
    
    // Filter out our own body and non-static bodies
    const platforms = bodies.filter(body => 
      body.id !== this.body.id && 
      body.isStatic
    );
    
    // If we found platforms, highlight them
    if (platforms.length > 0) {
      this.debugGraphics.lineStyle(2, 0x00ffff);
      
      platforms.forEach(platform => {
        // Get platform bounds
        const bounds = platform.bounds;
        this.debugGraphics.drawRect(
          bounds.min.x,
          bounds.min.y,
          bounds.max.x - bounds.min.x,
          bounds.max.y - bounds.min.y
        );
      });
    }
    
    // Check if we need to jump to reach the next waypoint
    if (currentTarget) {
      const dx = currentTarget.x - this.body.position.x;
      const dy = currentTarget.y - this.body.position.y;
      
      // Decide if we need to jump and/or move
      // If target is higher than current position
      if (dy < -App.config.tileSize/2) {
        return { 
          needJump: true, 
          needMove: Math.abs(dx) > App.config.tileSize/2 
        };
      }
      
      // If target is on a different level but at same x position
      if (Math.abs(dy) > App.config.tileSize*1.5 && Math.abs(dx) < App.config.tileSize/2) {
        return { needJump: false, needMove: false };
      }
      
      // If we found platforms and target requires horizontal movement
      if (platforms.length === 0 && Math.abs(dx) > App.config.tileSize*2) {
        // No platform detected but we need to cross a gap
        return { needJump: true, needMove: true };
      }
    }
    
    return { needJump: false, needMove: true };
  }
  
  // Follow the path
  followPath() {
    if (!this.isActive || this.path.length === 0 || this.currentPathIndex >= this.path.length) {
      this.debugText.text = "INACTIVE";
      return;
    }

    // Check if we're stuck
    this.checkIfStuck();
    
    // Check for platforms and obstacles
    const { needJump, needMove } = this.detectPlatforms();

    const currentTarget = this.path[this.currentPathIndex];
    const dx = currentTarget.x - this.body.position.x;
    const dy = currentTarget.y - this.body.position.y;
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
    
    // Update debug text
    this.debugText.text = `Idx: ${this.currentPathIndex}/${this.path.length-1}\nDist: ${distanceToTarget.toFixed(0)}`;
    
    // If we reached the current waypoint, move to the next one
    if (distanceToTarget < App.config.tileSize * 0.6) {
      // Mark waypoint as reached
      if (this.currentPathIndex < this.waypointReachedMarkers.length) {
        this.waypointReachedMarkers[this.currentPathIndex].clear();
        this.waypointReachedMarkers[this.currentPathIndex].circle(
          currentTarget.x, currentTarget.y, 5
        );
        this.waypointReachedMarkers[this.currentPathIndex].fill(0x00ff00);
      }
      
      // Move to next waypoint
      this.currentPathIndex++;
      console.log(`Reached waypoint ${this.currentPathIndex-1}, moving to next`);
      
      // Reset direction change tracker when reaching a waypoint
      this.directionChanges = 0;
      this.waitBeforeJump = 0;
      
      if (this.currentPathIndex >= this.path.length) {
        console.log("AI reached destination");
        this.reachedFlag = true;
        if (this.onReachDestination) {
          this.onReachDestination();
        }
        return;
      }
    }
    
    // Update cooldown counter
    if (this.movementCooldown > 0) {
      this.movementCooldown--;
      return;
    }
    
    // Determine if target requires a jump (higher than current position)
    const needsJump = dy < -App.config.tileSize/3;
    
    // Determine if we need to move horizontally
    const needsHorizontalMovement = Math.abs(dx) > 5;
    
    // Handle horizontal alignment before jumping
    if (needsJump && needsHorizontalMovement && this.canJump) {
      // If we're not horizontally aligned but target is above us, 
      // move horizontally to get in position before jumping
      const direction = dx > 0 ? 1 : -1;
      this.move(direction);
      this.lastDirection = direction;
      
      // Only jump when we're close enough horizontally (better aligned)
      if (Math.abs(dx) < App.config.tileSize / 2) {
        console.log("Horizontally aligned, jumping to reach higher platform");
        this.jump();
        this.movementCooldown = 10;
      }
      return;
    }
    
    // Basic movement logic
    if (needsHorizontalMovement) {
      const direction = dx > 0 ? 1 : -1;
      this.move(direction);
      this.lastDirection = direction;
    }
    
    // Jump if needed and able (when aligned or no horizontal movement needed)
    if (needsJump && this.canJump && !needsHorizontalMovement) {
      console.log("Jumping to reach higher waypoint");
      this.jump();
      this.movementCooldown = 10;
    }
    
    // If we're aligned but need to go down, just wait and let gravity work
    if (!needsHorizontalMovement && !needsJump && dy > App.config.tileSize) {
      this.movementCooldown = 5;
    }
  }
  
  update() {
    super.update();
    
    if (this.isActive) {
      this.followPath();
    }
  }
  
  activate() {
    this.isActive = true;
    this.reachedFlag = false;
    this.stuckCounter = 0;
    this.directionChanges = 0;
    this.lastDirection = 0;
    this.waitBeforeJump = 0;
    this.lastPosition = new PIXI.Point(this.body.position.x, this.body.position.y);
  }
  
  deactivate() {
    this.isActive = false;
    this.debugText.text = "";
    this.debugGraphics.clear();
  }
} 
