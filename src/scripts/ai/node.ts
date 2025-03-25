import * as PIXI from 'pixi.js';

export class Node {
  point: PIXI.Point;
  neighbors: Map<Node, number> = new Map();
  visited: boolean = false;
  parent: Node | null = null;

  constructor(point: PIXI.Point) {
    this.point = point;
  }

  addNeighbor(neighbor: Node, weight: number) {
    this.neighbors.set(neighbor, weight);
  }

  getNeighbors() {
    return this.neighbors;
  }
}
