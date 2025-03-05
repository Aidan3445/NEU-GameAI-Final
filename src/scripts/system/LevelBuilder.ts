import * as PIXI from 'pixi.js';
import { App } from './App';

export function buildLevel(levelPlan: string[]) {
  const playerStart: PIXI.Point = new PIXI.Point();
  const platforms: PIXI.Rectangle[] = [];
  for (let y = 0; y < levelPlan.length; y++) {
    for (let x = 0; x < levelPlan[y].length; x++) {
      if (levelPlan[y][x] === 'P') {
        platforms.push(new PIXI.Rectangle(x, y, 1, 1));
      } else if (levelPlan[y][x] === 'X') {
        playerStart.set(x, y);
      }
    }
  }

  const cameraBounds: PIXI.Point =
    new PIXI.Point(levelPlan[0].length * App.config.tileSize, levelPlan.length * App.config.tileSize);

  return { playerStart, platforms, cameraBounds };
} 
