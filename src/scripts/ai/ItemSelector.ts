import * as PIXI from 'pixi.js';
import { Adversary } from './Adversary';
import { Platform } from '../game/Platform';
import { Node } from "./node";
import { App } from '../system/App';

// Item types
export enum ItemType {
    Platform = 'Platform',
    Bomb = 'Bomb',
    Spikes = 'Spikes'
}

// Game state evaluation
interface GameState {
    playerItem: ItemType;            // The item player has selected
    levelState: string[];            // Current level state
    platformCount: number;           // Number of platforms in the level
    distanceToFlag: number;          // AI's distance to flag
    playerDistanceToFlag: number;    // Player's distance to flag
    criticalPaths: number;           // Number of critical/narrow paths in the level
    flagAccessibility: number;       // How easy it is to reach the flag (0-1)
}

/**
 * AI Item Selection Behavior Tree
 * Helps the AI decide which of the two remaining items to select after player has chosen one.
 */
export class ItemSelector {
    availableItems!: ItemType[]
    adversary! : Adversary
    platforms!: Platform[]
    levelPlan: string[]
    aiPos: PIXI.Point
    flagPos: PIXI.Point
    playerSpawn!: PIXI.Point

    constructor(playerSpawn: PIXI.Point, availableItems: ItemType[], adversary: Adversary, platforms: Platform[], levelPlan: string[], aiPos: PIXI.Point, flagPos: PIXI.Point) {
        this.playerSpawn = playerSpawn
        this.adversary = adversary
        this.availableItems = availableItems
        this.platforms = platforms
        this.levelPlan = levelPlan
        this.aiPos = aiPos
        this.flagPos = flagPos
    }
    
    /**
     * Decision tree to select the best item based on game state
     */
    selectItem(playerItem: ItemType): ItemType {
        // Get remaining items
        const remainingItems = this.availableItems;
        console.log('Remaining items:', remainingItems);

        const { path, pathWeights } = this.adversary.calculatePath(this.aiPos, this.flagPos, this.levelPlan, false);
        const sumPathWeights = pathWeights.reduce((acc, weight) => acc + weight, 0);
        
        if (path.length === 0) {
            // this is when no path is found originally
            console.log("No path found");
            return ItemType.Platform;
        }

        // start at the first one??
        let maxWeight = 0;
        let maxPathNode = path[0]
        let lastPathNode = path[0]

        for (let i = 1; i < pathWeights.length-1; i++) {
            const weight = pathWeights[i];
            if (weight > maxWeight) {
                if (i > 0) {
                    console.log('i am here')
                    maxWeight = weight;
                    maxPathNode = path[i];
                    lastPathNode = path[i-1]
                }
            }
        }

        // // platfrom check
        const sumPlatformWeights = this.checkPlatform(maxPathNode, lastPathNode);

        const sumSpikeWeights = this.checkSpike(maxPathNode);

        const sumBombWeights = this.checkBomb(maxPathNode);

        console.log('sumPathWeights', sumPathWeights, 'sumBombWeights', sumBombWeights, 'sumSpikeWeights', sumSpikeWeights, 'sumPlatformWeights', sumPlatformWeights)
        return this.availableItems[0]
    }

    checkPlatform(node : Node, lastNode : Node) {
        const levelPlanCopy = [...this.levelPlan]
        const x = node.point.x
        const y = node.point.y + 1

        console.log(lastNode.point.x, lastNode.point.y, x, y)
        const platformPoint = this.getVertex(lastNode.point.x, lastNode.point.y, x, y)

        console.log('platformPoint', platformPoint)
        this.updateLevelPlan(platformPoint, "P", 3, levelPlanCopy)

        const { path, pathWeights } = this.adversary.calculatePath(this.aiPos, this.flagPos, levelPlanCopy, true);
        if (path.length===0) {
            console.log('PATH IS EMPTY')
        }
        console.log('pathWeights', pathWeights)
        const validWeights = pathWeights.filter(weight => !isNaN(weight));
        const sumPathWeights = validWeights.reduce((acc, weight) => acc + weight, 0);
        
        return sumPathWeights
    }  

    getVertex(
    x1: number, // startX
    y1: number, // startY
    x2: number, // endX
    y2: number, // endY
    J: number = App.config.J,
    ): PIXI.Point {
    const BNumRoot = Math.sqrt(-J * (-J - (y2 - y1)));
    const BNumerator = 2 * -J - 2 * BNumRoot;
    const BDenominator = (x2 - x1);
    const B = BNumerator / BDenominator;

    const A = -(B ** 2) / (4 * -J);

    const C = y1;

    const x = -B/(2*A )+ x1
    const y = J + y1

    const point = new PIXI.Point(Math.floor(x), Math.floor(y)) 
    
    return point
    }

    checkSpike(node : Node) {
        const levelPlanCopy = [...this.levelPlan]
    
        // mod level plan to bomb it
        // call Astar
        const x = node.point.x
        const y = node.point.y + 1

        const spikePoint = new PIXI.Point(node.point.x, node.point.y)
        this.updateLevelPlan(spikePoint, "S", 1, levelPlanCopy)

        console.log('spikePoint', spikePoint)
        const { path, pathWeights } = this.adversary.calculatePath(this.aiPos, this.flagPos, levelPlanCopy, false);
        if (path.length===0) {
            console.log('PATH IS EMPTY')
        }
        console.log('pathWeights', pathWeights)
        const validWeights = pathWeights.filter(weight => !isNaN(weight));
        const sumPathWeights = validWeights.reduce((acc, weight) => acc + weight, 0);
        
        return sumPathWeights
    }
    
    checkBomb(node : Node) {
        const levelPlanCopy = [...this.levelPlan]
    
        // mod level plan to bomb it
        // call Astar
        const x = node.point.x
        const y = node.point.y + 1
        
        if (levelPlanCopy[y][x].toUpperCase() !== 'P') {
            console.log('space under is not platform!')
        }

        for (const platform of this.platforms) { 
            if (platform.gridRect.x <= x && platform.gridRect.x + platform.gridRect.width >= x &&
                platform.gridRect.y <= y && platform.gridRect.y + platform.gridRect.height >= y
            ) {
                
                if (this.isPlatformValid(platform)) {
                    this.blowUpPlatform(platform, levelPlanCopy)
                } else {
                    console.log(platform.gridRect.x, platform.gridRect.y)
                }
                break;
            }
        }

        const { path, pathWeights } = this.adversary.calculatePath(this.aiPos, this.flagPos, levelPlanCopy, false);
        if (path.length===0) {
            console.log('PATH IS EMPTY')
        }
        console.log('pathWeights', pathWeights)
        const validWeights = pathWeights.filter(weight => !isNaN(weight));
        const sumPathWeights = validWeights.reduce((acc, weight) => acc + weight, 0);
        
        return sumPathWeights
    }

    blowUpPlatform(platform: Platform, levelPlanCopy: String[]) {
        for (let i = 0; i < platform.gridRect.height; i++) {
        //   console.log('updating level plan from', )
            this.updateLevelPlan(
            new PIXI.Point(platform.gridRect.x, platform.gridRect.y + i),
            ' ',
            platform.gridRect.width,
            levelPlanCopy
        );
        }
    }

    updateLevelPlan(cell: PIXI.Point, newChar: string, length: number, levelPlanCopy: String[]) {
        // console.log('updating level plan', cell, newChar, length, this.levelPlan);
        levelPlanCopy[cell.y] = levelPlanCopy[cell.y].substring(0, cell.x) +
        newChar.repeat(length) +
        levelPlanCopy[cell.y].substring(cell.x + length);
    }

    isPlatformValid(platform: Platform) {
        // is under player spawn point
        if (platform.gridRect.x <= this.playerSpawn.x &&
            platform.gridRect.x + platform.gridRect.width >= this.playerSpawn.x &&
            platform.gridRect.y === this.aiPos.y + 1) {
            return false;
        }

        // is under adversary spawn point
        if (platform.gridRect.x <= this.aiPos.x &&
            platform.gridRect.x + platform.gridRect.width >= this.aiPos.x &&
            platform.gridRect.y === this.aiPos.y + 1) {
            return false;
        }

        // is under flag point
        if (platform.gridRect.x <= this.flagPos.x &&
            platform.gridRect.x + platform.gridRect.width >= this.flagPos.x &&
            platform.gridRect.y === this.flagPos.y + 1) {
            return false;
        }
        return true
    }

    /**
     * Main decision tree logic
     */
    private decisionTree(gameState: GameState, remainingItems: ItemType[]): ItemType {
        const { playerItem, platformCount, distanceToFlag, playerDistanceToFlag, criticalPaths, flagAccessibility } = gameState;

        // If we can't reach the flag, prioritize creating paths
        if (distanceToFlag > 0 && flagAccessibility < 0.3) {
            // We need to improve our path to the flag
            if (remainingItems.includes(ItemType.Platform)) {
                return ItemType.Platform;
            }
        }
        
        // If player has Platform and is far from flag, consider Bomb to disrupt their path
        if (playerItem === ItemType.Platform && playerDistanceToFlag > distanceToFlag) {
            if (remainingItems.includes(ItemType.Bomb)) {
                return ItemType.Bomb;
            }

            if (remainingItems.includes(ItemType.Spikes)){
                return ItemType.Spikes
            }

            return ItemType.Platform
        }
        
        // If player has Bomb and there are few platforms, pick Platform
        if (playerItem === ItemType.Bomb && platformCount < 20 && remainingItems.includes(ItemType.Platform)) {
            return ItemType.Platform;
        }

        if (playerItem === ItemType.Bomb && platformCount < 20 && !remainingItems.includes(ItemType.Platform)) {
            return ItemType.Spikes;
        }

        if (playerItem === ItemType.Bomb && platformCount < 20 && !remainingItems.includes(ItemType.Platform) && !remainingItems.includes(ItemType.Spikes)) {
            return ItemType.Bomb;
        }
        
        // If player has Spikes and we're struggling to reach the flag, pick Platform
        if (playerItem === ItemType.Spikes && distanceToFlag > 10 && remainingItems.includes(ItemType.Platform)) {
            return ItemType.Platform;
        }

        if (playerItem === ItemType.Spikes && distanceToFlag > 10 && !remainingItems.includes(ItemType.Platform)) {
            return ItemType.Spikes;
        }

        if (playerItem === ItemType.Spikes && distanceToFlag > 10 && !remainingItems.includes(ItemType.Platform) && !remainingItems.includes(ItemType.Spikes)) {
            return ItemType.Bomb;
        }
        
        // If player has Platform and there are already many platforms, use Bomb
        if (playerItem === ItemType.Platform && platformCount > 25 && remainingItems.includes(ItemType.Bomb)) {
            return ItemType.Bomb;
        }
        
        if (playerItem === ItemType.Platform && platformCount > 25 && !remainingItems.includes(ItemType.Bomb)) {
            return ItemType.Spikes;
        }
        
        if (playerItem === ItemType.Platform && platformCount > 25 && !remainingItems.includes(ItemType.Bomb) && !remainingItems.includes(ItemType.Spikes)) {
            return ItemType.Platform;
        }
        
        // If player is closer to flag than AI, consider Spikes to slow them down
        if (playerDistanceToFlag < distanceToFlag && remainingItems.includes(ItemType.Spikes)) {
            return ItemType.Spikes;
        }

        if (playerDistanceToFlag < distanceToFlag && !remainingItems.includes(ItemType.Spikes)) {
            return ItemType.Platform;
        }

        if (playerDistanceToFlag < distanceToFlag && !remainingItems.includes(ItemType.Spikes) && !remainingItems.includes(ItemType.Platform)) {
            return ItemType.Bomb;
        }
        
        // If player has Bomb and there are critical paths, choose Spikes for defense
        if (playerItem === ItemType.Bomb && criticalPaths > 0 && remainingItems.includes(ItemType.Spikes)) {
            return ItemType.Spikes;
        }

        if (playerItem === ItemType.Bomb && criticalPaths > 0 && !remainingItems.includes(ItemType.Spikes)) {
            return ItemType.Bomb;
        }

        if (playerItem === ItemType.Bomb && criticalPaths > 0 && !remainingItems.includes(ItemType.Spikes) && !remainingItems.includes(ItemType.Bomb)) {
            return ItemType.Platform;
        }
        
        // If player has Spikes and is far from flag, pick Bomb to disrupt potential platforms
        if (playerItem === ItemType.Spikes && playerDistanceToFlag > 15 && remainingItems.includes(ItemType.Bomb)) {
            return ItemType.Bomb;
        }

        if (playerItem === ItemType.Spikes && playerDistanceToFlag > 15 && !remainingItems.includes(ItemType.Bomb)) {   
            return ItemType.Spikes;
        }

        if (playerItem === ItemType.Spikes && playerDistanceToFlag > 15 && !remainingItems.includes(ItemType.Bomb) && !remainingItems.includes(ItemType.Spikes)) {  
            return ItemType.Platform;
        }
        
        // Default strategy based on flag accessibility
        if (flagAccessibility < 0.5) {
            // Flag is hard to reach, prioritize creating paths
            if (remainingItems.includes(ItemType.Platform)) return ItemType.Platform;
            if (remainingItems.includes(ItemType.Bomb)) return ItemType.Bomb;
        } else {
            // Flag is easier to reach, prioritize defensive options
            if (remainingItems.includes(ItemType.Spikes)) return ItemType.Spikes;
            if (remainingItems.includes(ItemType.Bomb)) return ItemType.Bomb;
        }
        
        // If we reach here, just pick the first remaining item
        return remainingItems[0];
    }

  }