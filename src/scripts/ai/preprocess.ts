import * as PIXI from 'pixi.js';
import { Node } from './node';
import { App } from '../system/App';

export function getLevelNodes(levelPlan: string[]) {
  const nodes: Map<[number, number], Node> = new Map();

  // Get all the spaces above a platform that you can stand on
  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (levelPlan[y][x] === 'P') {
        const traversible = y === 0 || [' ', 'X', 'F'].includes(levelPlan[y - 1][x]);
        if (traversible) {
          const node = new Node(new PIXI.Point(x, y - 1));
          nodes.set([x, y - 1], node);
        }
      }
    }
  }

  // Add neighbors to each node
  for (const [_, node] of nodes) {
    // getNeighbors(node, nodes, levelPlan);
  }

  console.log(JSON.stringify(nodes, null, 2));
}

function getNeighbors(node: Node, nodes: Map<[number, number], Node>, levelPlan: string[]) {
  const { x, y } = node.point;
  const tileSize = App.config.tileSize;

  // check left and right (walking)
  // neighbor is the tile above the platform that's valid
  const left = nodes.get([x - 1, y]);
  if (left) {
    node.addNeighbor(left, 1);
  }
  const right = nodes.get([x + 1, y]);
  if (right) {
    node.addNeighbor(right, 1);
  }

  // check can jump
  if (levelPlan[y - 1][x] !== ' ') {
    return;
  }

  // check jumps left

}

