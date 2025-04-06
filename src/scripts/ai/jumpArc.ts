/**
 * Checks if the straight line between (x1, y1) and (x2, y2)
 * is blocked by a non-traversible tile.
 *
 * For a robust tile-based approach, you might want a real Bresenham’s line algorithm.
 * This simpler approach samples the line in small "t" increments.
 */
function isLineOfSightClear(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    levelPlan: string[],
    traversibleChars: string[] = [' ', 'X', 'F', 'S']
  ): boolean {
    const steps = 20; // how many samples to take (tweak to your liking)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
  
      // Linear interpolation in tile space
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
  
      // Round to nearest tile (or floor, if you prefer)
      const tx = Math.round(x);
      const ty = Math.round(y);
  
      // If we are outside the level bounds, treat as blocked (optional)
      if (ty < 0 || ty >= levelPlan.length || tx < 0 || tx >= levelPlan[ty].length) {
        return false;
      }
  
      // If the tile at (tx, ty) is NOT traversible, blocked
      if (!traversibleChars.includes(levelPlan[ty][tx])) {
        return false;
      }
    }
  
    return true; // no blocked tile found
  }

  
export function getArcApex(
    xStart: number,
    yStart: number,
    xEnd: number,
    config: { M: number; J: number }
  ): { x: number; y: number } {
    // Midway in x space
    const xMid = Math.floor((xStart + xEnd) / 2);
  
    // dx is relative to xStart
    const dx = xMid - xStart; // can be negative if xMid < xStart
    // same formula as your code
    const yOffset = Math.floor((dx / config.J) * (dx - config.M));
    const yMid = yStart + yOffset;
    // console.log(yOffset)
    // const yMid = yStart + config.M;
  
    return { x: xMid, y: yMid };
  }

  /**
 * Example usage:
 *
 * 1) We assume you know (xStart, yStart) and (xEnd, yEnd)
 *    from your pathfinding code. 
 * 2) apex is the highest point in integer tile coords (or halfway x)
 * 3) Check LOS in two segments
 */
export function canMake2SegmentJump(
    xStart: number,
    yStart: number,
    xEnd: number,
    yEnd: number,
    config: { M: number; J: number },
    levelPlan: string[]
  ): boolean {
    // console.log('canMake2SegmentJump', xStart, yStart, xEnd, yEnd);
    const apex = getArcApex(xStart, yStart, xEnd, config);
  
    // 1) LOS from start -> apex
    const clear1 = isLineOfSightClear(
      xStart, yStart,
      apex.x, apex.y,
      levelPlan
    );
  
    if (!clear1) return false;
  
    // 2) LOS from apex -> end
    const clear2 = isLineOfSightClear(
      apex.x, apex.y,
      xEnd, yEnd,
      levelPlan
    );
  
    return clear2;
  }
  
  
  export function getAllPointsInParabola(
    xStart: number,
    yStart: number,
    xEnd: number,
    config: { M: number; J: number }
  ): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
  
    // Ensure xStart <= xEnd for forward iteration
    const step = xStart < xEnd ? 1 : -1;
  
    for (let x = xStart; x !== xEnd + step; x += step) {
      // Parabolic-like y offset (custom formula)
      const yOffset = 2 * x
      points.push({ x, y: yStart + yOffset });
    }
  
    return points;
  }
  