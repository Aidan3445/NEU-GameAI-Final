import * as PIXI from 'pixi.js';

export class Node {
  point: PIXI.Point;
  neighbors: Map<string, number> = new Map();
  visited: boolean = false;
  parent: Node | null = null;

  constructor(point: PIXI.Point) {
    this.point = point;
  }

  addNeighbor(neighborKey: string, weight: number) {
    const existingWeight = this.neighbors.get(neighborKey);
    this.neighbors.set(neighborKey, Math.min(weight, existingWeight ?? Infinity));
  }

  getNeighbors() {
    return this.neighbors;
  }
}
