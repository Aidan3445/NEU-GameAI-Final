import * as PIXI from 'pixi.js';
import { Adversary } from './Adversary';
import path from 'path';

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
    constructor(private availableItems: ItemType[]) {}
    
    /**
     * Decision tree to select the best item based on game state
     */
    selectItem(playerItem: ItemType, levelPlan: string[], aiPos: PIXI.Point, flagPos: PIXI.Point, adversary: Adversary): ItemType {
        // Get remaining items
        const remainingItems = this.availableItems;
        console.log('Remaining items:', remainingItems);
        return remainingItems[0]
        
        const { path, pathWeights } = adversary.calculatePath(aiPos, flagPos, levelPlan, false);
        const sumPathWeights = pathWeights.reduce((acc, weight) => acc + weight, 0);
        
        if (path.length === 0) {
            // this is when no path is found originally
            console.log("No path found");
            return ItemType.Platform;
        }

        // start at the first one??
        const maxWeight = pathWeights[0];
        const maxPathNode = path[0]

        for (let i = 0; i < pathWeights.length; i++) {
            const weight = pathWeights[i];
            if (weight > maxWeight) {
                let maxWeight = weight;
                const pathNode = path[i+1];
            }
        }

        addPlatform(pathIndex, levelPlan);
        

        
        
        // Analyze current game state
        const gameState = this.analyzeGameState(levelPlan, adversary);
        gameState.playerItem = playerItem;
        
        // Decision tree based on player's item and game state
        return this.decisionTree(gameState, remainingItems);
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