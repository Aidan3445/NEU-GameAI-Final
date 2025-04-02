import * as PIXI from 'pixi.js';
import { Node } from './node';
import { App } from '../system/App';

export function getNodeKey(x: number, y: number) {
  return `${x},${y}`;
}

export function getLevelNodes(levelPlan: string[]) {
  const nodes: Map<string, Node> = new Map();

  // Get all the spaces above a platform that you can stand on
  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (levelPlan[y][x] === 'P') {
        console.log(`Found platform at ${x},${y}`);
        const traversible = y === 0 || [' ', 'X', 'F'].includes(levelPlan[y - 1][x]);
        if (traversible) {
          const node = new Node(new PIXI.Point(x, y - 1));
          const key = `${x},${y - 1}`;
          nodes.set(key, node);
        }
      }
    }
  }

  // Add neighbors to each node
  // for (const [_, node] of nodes) {
  //   // console.log('node', node.point.x, node.point.y);
  //   getNeighbors(node, nodes, levelPlan);
  // }
  getNeighbors(nodes.get(getNodeKey(19,23))!, nodes, levelPlan);
  const curNodes = nodes.get(getNodeKey(19,23))!;
  // const tempNodes = new Map<string, Node>();
  // for (const curNode of curNodes.neighbors) {
  //   tempNodes.set(getNodeKey(curNode.point.x, ), curNode);
  // }
  

  return {nodes, neighbors: curNodes.neighbors}
}

function getNeighbors(node: Node, nodes: Map<string, Node>, levelPlan: string[]) {
  const tileSize = App.config.tileSize;

  // check left and right (walking)
  // neighbor is the tile above the platform that's valid
  const left = nodes.get(getNodeKey(node.point.x - 1, node.point.y));
  if (left) {
    node.addNeighbor(getNodeKey(node.point.x - 1, node.point.y), 1);
  }
  const right = nodes.get(getNodeKey(node.point.x + 1, node.point.y));
  if (right) {
    node.addNeighbor(getNodeKey(node.point.x + 1, node.point.y), 1);
  }

  // check can jump
  if (nodes.get(getNodeKey(node.point.y - 1, node.point.x))) {
    return;
  }

  const h = Math.floor((App.config.M * App.config.M) / (4 * App.config.J) / tileSize);
  // console.log('h', h);

  // check jumps left under the parabola
  console.log('xLoopfrom', node.point.x-20, 'to', node.point.x - (App.config.M/tileSize)/2);
  for (let x = node.point.x-20; x <= node.point.x - (App.config.M/tileSize)/2; x++) {
    const inputX = (x - node.point.x) * tileSize;
    const yMax = Math.floor((inputX / App.config.J) * (inputX - App.config.M) / tileSize);
    console.log('actualX', x);
    console.log('yMax', yMax, 'inputX', inputX);
    console.log('yLoopfrom', node.point.y - yMax, 'to', node.point.y + 20);
    for (let y = node.point.y - yMax; y <= node.point.y + 20; y++) {
      const nodeUnderParabola = nodes.get(getNodeKey(x + 1, y));
      if (nodeUnderParabola) {
        node.addNeighbor(getNodeKey(x + 1, y), 1);
        console.log('nodeUnderParabola', nodeUnderParabola.point.x, nodeUnderParabola.point.y);
        break;
      }
    }
  }

}
  




