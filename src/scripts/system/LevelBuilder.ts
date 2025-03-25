import * as PIXI from 'pixi.js';
import { App } from './App';

export function buildLevel(levelPlan: string[]) {
  const playerStart: PIXI.Point = new PIXI.Point();
  const flagPoint: PIXI.Point = new PIXI.Point();
  const platforms: PIXI.Rectangle[] = [];

  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (levelPlan[y][x] === 'X') {
        playerStart.set(x, y);
      }
      if (levelPlan[y][x] === 'P') {
        const { block, marked } = getBlock(x, y, levelPlan);
        platforms.push(block);

        // mark the block as visited
        for (let i = block.y; i < block.y + block.height; i++) {
          for (let j = block.x; j < block.x + block.width; j++) {
            levelPlan[i] = levelPlan[i].substring(0, j) + marked + levelPlan[i].substring(j + 1);
          }
        }
      }
      if (levelPlan[y][x] === 'F') {
        flagPoint.set(x, y);
      }
    }
  }

  const levelRect: PIXI.Rectangle =
    new PIXI.Rectangle(0, 0, levelPlan[0].length * App.config.tileSize, levelPlan.length * App.config.tileSize);

  return { playerStart, platforms, levelRect, flagPoint};
}

function getBlock(x: number, y: number, levelPlan: string[]) {
  const rect = new PIXI.Rectangle(x, y, 1, 1);
  const blockType = levelPlan[y][x];

  // expand horizontally until we see a different block
  for (let i = x + 1; i < levelPlan[y].length; i++) {
    if (levelPlan[y][i] === blockType) {
      rect.width++;
    } else {
      break;
    }
  }

  // expand vertically until we see a different block
  // ensuring that the block is rectangular
  for (let i = y + 1; i < levelPlan.length; i++) {
    let isBlock = true;
    for (let j = x; j < x + rect.width; j++) {
      if (levelPlan[i][j] !== blockType) {
        isBlock = false;
        break;
      }
    }
    if (isBlock) {
      rect.height++;
    } else {
      break;
    }
  }

  return { block: rect, marked: blockType.toLowerCase() };
}

