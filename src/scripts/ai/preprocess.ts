import * as PIXI from 'pixi.js';
import { Node } from './node';
import { App } from '../system/App';

const traversableChars = [' ', 'X', 'F', 'S'];
// remove S when we implement spikes

export function getNodeKey(x: number, y: number) {
  return `${x},${y}`;
}

export function getLevelNodes(levelPlan: string[], log: boolean = false) {
  const nodes: Map<string, Node> = new Map();
  let debugPlayerStart: PIXI.Point | null = null;

  // Get all the spaces above a platform that you can stand on
  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (!traversableChars.includes(levelPlan[y][x])) {
        const traversible = y === 0 || traversableChars.includes(levelPlan[y - 1][x]);
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
    setNeighbors(node, nodes, levelPlan, log);
    //log && node.point.x === debugPlayerStart?.x && node.point.y === debugPlayerStart?.y);
  }

  return nodes;
}



export function setNeighbors(
  node: Node,
  nodes: Map<string, Node>,
  levelPlan: string[],
  log: boolean = false) {
  const MAX_JUMP_HEIGHT = Math.floor((App.config.M * App.config.M) / (4 * App.config.J));
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
  for (let x = leftRectBound; x <= rightRectBound; x++) {
    for (let y = node.point.y - MAX_JUMP_HEIGHT; y <= node.point.y + 20; y++) {
      if (x === node.point.x && y == node.point.y) continue; // skip the node itself
      const nodeInCenterRect = nodes.get(getNodeKey(x, y));
      if (nodeInCenterRect) {
        // check if the path is clear
        if (clearArc(node, nodeInCenterRect, levelPlan, log)) {
          node.addNeighbor(getNodeKey(x, y), 10);
          break;
        }
      }
    }
  }

  // check left and right parabolas
  // we can do this simultaneously since the parabola is symmetric
  // we are only checking X values to the left of the center rectangle
  // with a max range of roughly 1.5 * the flat jump distance (App.config.M)
  for (let x = Math.floor(App.config.M / 2); x <= Math.floor(App.config.M * 1.5); x++) {

    const leftX = node.point.x - x;
    const rightX = node.point.x + x;
    const yMax = node.point.y + Math.floor((x / App.config.J) * (x - App.config.M));
    // check if the node is within the parabola up to 20 tiles below the tile
    for (let y = yMax; y <= yMax + 20; y++) {
      const nodeUnderParabolaLeft = nodes.get(getNodeKey(leftX, y));
      if (nodeUnderParabolaLeft) {
        // check if the path is clear
        if (clearArc(node, nodeUnderParabolaLeft, levelPlan, log)) {
          node.addNeighbor(getNodeKey(leftX, y), 10);
        }
      }

      const nodeUnderParabolaRight = nodes.get(getNodeKey(rightX, y));
      if (nodeUnderParabolaRight) {
        // check if the path is clear
        if (clearArc(node, nodeUnderParabolaRight, levelPlan, log)) {
          node.addNeighbor(getNodeKey(rightX, y), 10);
        }
      }
    }
  }
  //*/
}

// https://www.desmos.com/calculator/mwoejliess
export function estimateArc(
  x: number, // input
  x1: number, // startX
  y1: number, // startY
  x2: number, // endX
  y2: number, // endY
  J: number, // max jump height
): number {
  const BNumRoot = Math.sqrt(-J * (-J - (y2 - y1)));
  const BNumerator = 2 * -J - 2 * BNumRoot;
  const BDenominator = (x2 - x1);
  const B = BNumerator / BDenominator;

  const A = -(B ** 2) / (4 * -J);

  const C = y1;

  const input = x - x1;

  return A * (input ** 2) + (B * input) + C;
}

// https://dedu.fr/projects/bresenham/
export function clearLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  levelPlan: string[],
  log: boolean = false,
): boolean {
  let y = Math.round(y1);
  let x = Math.round(x1);
  let dx = Math.round(x2 - x1);
  let dy = Math.round(y2 - y1);
  let ystep: number;
  let xstep: number;
  let ddy: number;
  let ddx: number;
  let error: number;
  let errorprev: number;

  // check if the start point is traversable
  if (!traversableChars.includes(levelPlan[y]?.[x])) {
    return false;
  }

  if (dy < 0) {
    ystep = -1;
    dy = -dy;
  } else {
    ystep = 1;
  }

  if (dx < 0) {
    xstep = -1;
    dx = -dx;
  } else {
    xstep = 1;
  }

  ddy = 2 * dy;
  ddx = 2 * dx;

  if (ddx >= ddy) {
    errorprev = error = dx;
    for (let i = 0; i < dx; i++) {
      x += xstep;
      error += ddy;
      if (error > ddx) {
        y += ystep;
        error -= ddx;

        // check if the point is traversable
        if (error + errorprev < ddx) {
          if (!traversableChars.includes(levelPlan[y - ystep]?.[x])) {
            return false;
          }
        } else if (error + errorprev > ddx) {
          if (!traversableChars.includes(levelPlan[y]?.[x - xstep])) {
            return false;
          }
        } else {
          if (!traversableChars.includes(levelPlan[y]?.[x - xstep]) ||
            !traversableChars.includes(levelPlan[y - ystep]?.[x])) {
            return false;
          }
        }
      }
      if (!traversableChars.includes(levelPlan[y]?.[x])) {
        return false;
      }
      errorprev = error;
    }
  } else {
    errorprev = error = dy;
    for (let i = 0; i < dy; i++) {
      y += ystep;
      error += ddx;
      if (error > ddy) {
        x += xstep;
        error -= ddy;

        // check if the point is traversable
        if (error + errorprev < ddy) {
          if (!traversableChars.includes(levelPlan[y]?.[x - xstep])) {
            return false;
          }
        } else if (error + errorprev > ddy) {
          if (!traversableChars.includes(levelPlan[y - ystep]?.[x])) {
            return false;
          }
        } else {
          if (!traversableChars.includes(levelPlan[y - ystep]?.[x]) ||
            !traversableChars.includes(levelPlan[y]?.[x - xstep])) {
            return false;
          }
        }
      }
      if (!traversableChars.includes(levelPlan[y]?.[x])) {
        return false;
      }
      errorprev = error;
    }
  }

  // we have reached the end point and the path is clear
  return true;
}

// check if the path is clear along an arc from the start node to the end node
export function clearArc(
  node: Node,
  node2: Node,
  levelPlan: string[],
  log: boolean = false,
  steps: number = 20,
): boolean {
  const stepSize = (node2.point.x - node.point.x) / steps;

  let prevX = node.point.x;
  let prevY = node.point.y;

  // bonk is when the jump hits a platform above on the way up
  // once we bonk, we shift the arc estimate to treat the bonk as the new vertex
  // this allows the AI to continue to the side for extra neighbors

  for (let i = 1; i < steps; i++) {
    const step = node.point.x + i * stepSize;

    const y = estimateArc(
      step,
      node.point.x,
      node.point.y,
      node2.point.x,
      node2.point.y,
      App.config.J,
    );

    if (!clearLine(
      prevX,
      prevY,
      step,
      y,
      levelPlan,
      log,
    )) {
      return false;
    } else {
      prevX = step;
      prevY = y;
    }
  }

  // we have reached the end point and the path is clear
  return true;
}
