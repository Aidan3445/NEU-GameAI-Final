import * as PIXI from 'pixi.js';
import { Node } from './node';
import { App } from '../system/App';

const traversableChars = [' ', 'X', 'A', 'F'];

export function getNodeKey(x: number, y: number) {
  return `${x},${y}`;
}

export function getLevelNodes(levelPlan: string[], log: boolean = false) {
  const nodes: Map<string, Node> = new Map();
  // let debugPlayerStart: PIXI.Point | null = null;

  // Get all the spaces above a platform that you can stand on
  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (levelPlan[y][x].toUpperCase() === 'P') {
        const traversible = y === 0 || traversableChars.includes(levelPlan[y - 1][x]);
        if (traversible) {
          const node = new Node(new PIXI.Point(x, y - 1));
          nodes.set(getNodeKey(x, y - 1), node);
          if (x === 39 && y - 1 === 18) console.log('Found it', levelPlan[19][39]);
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
    for (let y = node.point.y - MAX_JUMP_HEIGHT; y <= node.point.y + 10; y++) {
      if (x === node.point.x && y == node.point.y) continue; // skip the node itself
      const nodeInCenterRect = nodes.get(getNodeKey(x, y));
      if (nodeInCenterRect) {
        // check if the path is clear
        if (clearArc(node, nodeInCenterRect, levelPlan, log)) {
          node.addNeighbor(
            getNodeKey(x, y),
            jumpArcLength(node.point.x, node.point.y, x, y, App.config.J),
          );
          break;
        }
      }
    }
  }

  /*
    * Would have loved to get this to work
    *
  // check left and right parabolas
  // we can do this simultaneously since the parabola is symmetric
  // we are only checking X values to the left of the center rectangle
  // with a max range of roughly 1.5 * the flat jump distance (App.config.M)
  for (let x = Math.floor(App.config.M / 2); x <= Math.floor(App.config.M * 1.5); x++) {
    const leftX = node.point.x - x;
    const rightX = node.point.x + x;
    const yMax = node.point.y + App.config.J;
    // check if the node is within the parabola up to 20 tiles below the tile
    for (let y = yMax; y <= yMax + 5; y++) {
      const nodeUnderParabolaLeft = nodes.get(getNodeKey(leftX, y));
      if (nodeUnderParabolaLeft) {
        // check if the path is clear
        if (clearArc(node, nodeUnderParabolaLeft, levelPlan, log)) {
          node.addNeighbor(
            getNodeKey(leftX, y),
            jumpArcLength(node.point.x, node.point.y, leftX, y, App.config.J),
          );
        }
      }

      const nodeUnderParabolaRight = nodes.get(getNodeKey(rightX, y));
      if (nodeUnderParabolaRight) {
        // check if the path is clear
        if (clearArc(node, nodeUnderParabolaRight, levelPlan, log)) {
          node.addNeighbor(
            getNodeKey(rightX, y),
            jumpArcLength(node.point.x, node.point.y, rightX, y, App.config.J),
          );
        }
      }
    }
  }
  //*/
}

// https://www.desmos.com/calculator/kptaary8ro
export function estimateArc(
  x: number, // input
  x1: number, // startX
  y1: number, // startY
  x2: number, // endX
  y2: number, // endY
  J: number = App.config.J,
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

export function estimateArcInverse(
  y: number, // input
  yVelocity: number,
  x1: number, // startX
  y1: number, // startY
  x2: number, // endX
  y2: number, // endY
  J: number = App.config.J,
): number {
  const BNumRoot = Math.sqrt(-J * (-J - (y2 - y1)));
  const BNumerator = 2 * -J - 2 * BNumRoot;
  const BDenominator = (x2 - x1);
  const B = BNumerator / BDenominator;

  const A = -(B ** 2) / (4 * -J);

  const C = y1 - y;

  // Determine if we're in the up or down phase of the jump
  const goingRight = x1 < x2;
  const isUpPhase = yVelocity > 0;

  // Choose the correct side of the parabola based on direction and phase
  const sign = goingRight ? (isUpPhase ? 1 : -1) : (isUpPhase ? -1 : 1);

  // Calculate the discriminant
  let discriminant = B ** 2 - (4 * A * (C));
  if (discriminant < 0) {
    discriminant = 0;
  }

  // solve for x
  return (-B + sign * Math.sqrt(discriminant)) / (2 * A);
}

export function jumpArcLength(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  J: number = App.config.J,
): number {
  const BNumRoot = Math.sqrt(-J * (-J - (y2 - y1)));
  const BNumerator = 2 * -J - 2 * BNumRoot;
  const BDenominator = (x2 - x1);
  const B = BNumerator / BDenominator;

  const A = -(B ** 2) / (4 * -J);

  const derivative = (x: number) => {
    return 2 * A * x + B;
  };

  const integral = (x: number) => {
    const logTerm = Math.log(Math.abs(Math.sqrt(derivative(x) ** 2 + 1) + derivative(x)));
    const numerator = logTerm + derivative(x) * Math.sqrt(derivative(x) ** 2 + 1);
    const denominator = 4 * A;

    return numerator / denominator;
  };

  return Math.abs(integral(x2) - integral(x1));
}

// https://stackoverflow.com/questions/18881456/supercover-dda-algorithm
export function clearLine(xStart: number, yStart: number, xEnd: number, yEnd: number, levelPlan: string[], log: boolean = false) {
  const check = (offsetY: number) => {
    const x0 = xStart + 0.5;
    const y0 = yStart + offsetY;
    const x1 = xEnd + 0.5;
    const y1 = yEnd + offsetY;

    const vx = x1 - x0;
    const vy = y1 - y0;

    const dx = Math.sqrt(1 + (vy / vx) ** 2);
    const dy = Math.sqrt(1 + (vx / vy) ** 2);

    let ix = Math.floor(x0);
    let iy = Math.floor(y0);

    let sx, ex;
    if (vx < 0) {
      sx = -1;
      ex = (x0 - ix) * dx;
    } else {
      sx = 1;
      ex = (ix + 1 - x0) * dx;
    }

    let sy, ey;
    if (vy < 0) {
      sy = -1;
      ey = (y0 - iy) * dy;
    } else {
      sy = 1;
      ey = (iy + 1 - y0) * dy;
    }

    const len = Math.sqrt(vx ** 2 + vy ** 2);
    let done = false;

    while (Math.min(ex, ey) <= len) {
      const rx = ix;
      const ry = iy;
      if (ex < ey) {
        ex += dx;
        ix += sx;
      } else {
        ey += dy;
        iy += sy;
      }
      if (!traversableChars.includes(levelPlan[ry]?.[rx]) && ry >= 0) {
        if (log) {
          console.log(`Blocked at (${rx}, ${ry})`);
        }
        return false;
      }
    }

    if (!done) {
      done = true;
      if (!traversableChars.includes(levelPlan[iy]?.[ix]) && iy >= 0) {
        if (log) {
          console.log(`Blocked at (${ix}, ${iy})`);
        }
        return false;
      }
    }

    return true;
  }

  // we want to make sure the whole character can fit so we run 
  // the check twice, bit of a hack but works for most cases
  return check(0) && check(0.5);
}


// check if the path is clear along an arc from the start node to the end node
export function clearArc(
  node: Node,
  node2: Node,
  levelPlan: string[],
  log: boolean = false,
  steps: number = 100,
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
    );

    if (!clearLine(
      prevX,
      prevY,
      step,
      y,
      levelPlan,
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
