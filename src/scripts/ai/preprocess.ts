import * as PIXI from 'pixi.js';
import { Node } from './node';
import { App } from '../system/App';

const traversibleChars = [' ', 'X', 'F', 'S'];
// remove S when we implement spikes

export function getNodeKey(x: number, y: number) {
  return `${x},${y}`;
}

export function getLevelNodes(levelPlan: string[]) {
  const nodes: Map<string, Node> = new Map();
  let debugPlayerStart: PIXI.Point | null = null;

  // Get all the spaces above a platform that you can stand on
  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (!traversibleChars.includes(levelPlan[y][x])) {
        const traversible = y === 0 || traversibleChars.includes(levelPlan[y - 1][x]);
        if (traversible) {
          if (levelPlan[y - 1]?.[x] === 'X') {
            debugPlayerStart = new PIXI.Point(x, y - 1);
          }
          const node = new Node(new PIXI.Point(x, y - 1));
          const key = `${x},${y - 1}`;
          nodes.set(key, node);
        }
      }
    }
  }

  // Add neighbors to each node
  for (const [_, node] of nodes) {
    setNeighbors(node, nodes, levelPlan);
  }

  return nodes;
}

export function setNeighbors(node: Node, nodes: Map<string, Node>, levelPlan: string[]) {
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

  // check can jump (nothing directly above)
  if (levelPlan[node.point.y - 1]?.[node.point.x] !== ' ') return;

  // if we can jump, split checks into three parts with no overlap
  // center rectangle and two parabolic arcs on the left and right

  // check center rectangle
  const leftRectBound = node.point.x - Math.floor(App.config.M / 2);
  const rightRectBound = node.point.x + Math.floor(App.config.M / 2);
  const maxJumpHeight = Math.floor((App.config.M * App.config.M) / (4 * App.config.J));
  for (let x = leftRectBound; x <= rightRectBound; x++) {
    for (let y = node.point.y - maxJumpHeight; y <= node.point.y + 20; y++) {
      if (x === node.point.x && y == node.point.y) continue; // skip the node itself
      const nodeInCenterRect = nodes.get(getNodeKey(x, y));
      if (nodeInCenterRect) {
        node.addNeighbor(getNodeKey(x, y), 2);
        break;
      }
    }
  }

  // check left and right parabolas
  // we can do this simultaneously since the parabola is symmetric
  // we are only checking X values to the left of the center rectangle
  // with a max range of roughly 1.5 * the flat jump distance (App.config.M)
  for (let x = Math.floor(App.config.M / 2); x <= Math.floor(App.config.M * 1.5); x++) {
    // track if x values have been hit
    let leftHit = false;
    let rightHit = false;

    const leftX = node.point.x - x;
    const rightX = node.point.x + x;
    const yMax = node.point.y + Math.floor((x / App.config.J) * (x - App.config.M));
    // check if the node is within the parabola up to 20 tiles below the tile
    // console.log('leftX =', leftX, 'rightX =', rightX, 'yMax =', yMax);
    for (let y = yMax; y <= yMax + 20; y++) {
      // console.log(`(${leftX}, ${y})${leftHit ? '-X' : ''}, (${rightX}, ${y})${rightHit ? '-X' : ''}`);

      if (!leftHit) {
        const nodeUnderParabolaLeft = nodes.get(getNodeKey(leftX, y));
        if (nodeUnderParabolaLeft) {
          node.addNeighbor(getNodeKey(leftX, y), 2);
          leftHit = true;
          // console.log('leftHit', leftX, y);
        }
      }

      if (!rightHit) {
        const nodeUnderParabolaRight = nodes.get(getNodeKey(rightX, y));
        if (nodeUnderParabolaRight) {
          node.addNeighbor(getNodeKey(rightX, y), 2);
          rightHit = true;
          // console.log('rightHit', rightX, y);
        }
      }

      // if both hits are found, break
      if (leftHit && rightHit) {
        break;
      }
    }
  }
  //*/

}
