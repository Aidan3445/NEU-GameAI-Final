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
    this.neighbors.set(neighborKey, weight);
  }

  getNeighbors() {
    return this.neighbors;
  }
}
