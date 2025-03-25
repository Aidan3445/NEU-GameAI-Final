import * as PIXI from 'pixi.js';
import { Node } from './node';

export function getLevelNodes(levelPlan: string[]) {
  const nodes: Node[] = [];

  // Get all the spaces above a platform that you can stand on
  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (levelPlan[y][x] === 'P') {
        const traversible = y === 0 || [' ', 'X', 'F'].includes(levelPlan[y - 1][x]);
        if (traversible) {
          const node = new Node(new PIXI.Point(x, y - 1));
          nodes.push(node);
        }
      }
    }
  }

  // Add neighbors to each node
  for (const node of nodes) {
    getNeighbors(node, nodes, levelPlan);
  }

  console.log(JSON.stringify(nodes, null, 2));
}

function getNeighbors(node: Node, nodes: Node[], levelPlan: string[]) {
  const { x, y } = node.point;


}

