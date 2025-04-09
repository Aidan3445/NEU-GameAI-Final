import * as PIXI from 'pixi.js';

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
     * Analyze the current game state
     */
    analyzeGameState(levelPlan: string[], playerPos: PIXI.Point, aiPos: PIXI.Point, flagPos: PIXI.Point): GameState {
        // Calculate platform count
        const platformCount = levelPlan.reduce((count, row) => 
            count + (row.match(/P/g) || []).length, 0);
        
        // Simple distance calculation (can be improved with actual pathfinding)
        const distanceToFlag = Math.abs(aiPos.x - flagPos.x) + Math.abs(aiPos.y - flagPos.y);
        const playerDistanceToFlag = Math.abs(playerPos.x - flagPos.x) + Math.abs(playerPos.y - flagPos.y);

        // Determine critical paths by checking for narrow passages
        let criticalPaths = 0;
        for (let y = 0; y < levelPlan.length; y++) {
            let inPath = false;
            let pathWidth = 0;
            
            for (let x = 0; x < levelPlan[y].length; x++) {
                if (levelPlan[y][x] === ' ' && (y + 1 >= levelPlan.length || levelPlan[y + 1][x] === 'P')) {
                    if (!inPath) {
                        inPath = true;
                        pathWidth = 0;
                    }
                    pathWidth++;
                } else if (inPath) {
                    inPath = false;
                    if (pathWidth <= 3) {
                        criticalPaths++;
                    }
                }
            }
        }
        
        // Estimate flag accessibility (lower is harder)
        // This is a simplified calculation - the actual implementation would use pathfinding
        const flagAccessibility = this.calculateFlagAccessibility(levelPlan, flagPos);
        
        return {
            playerItem: ItemType.Platform, // This will be set by the caller
            levelState: levelPlan,
            platformCount,
            distanceToFlag,
            playerDistanceToFlag,
            criticalPaths,
            flagAccessibility
        };
    }
    
    /**
     * Calculate how accessible the flag is (0-1, where 1 is easily accessible)
     */
    private calculateFlagAccessibility(levelPlan: string[], flagPos: PIXI.Point): number {
        // Check if flag is on a platform and how many platforms are nearby
        const flagY = Math.floor(flagPos.y);
        const flagX = Math.floor(flagPos.x);
        
        // Check if there's a platform below the flag
        const hasPlatformBelow = flagY + 1 < levelPlan.length && 
                                levelPlan[flagY + 1][flagX] === 'P';
        
        if (!hasPlatformBelow) {
            return 0.9; // Flag is floating, easy to access
        }
        
        // Check number of platforms surrounding the flag
        let platformsAround = 0;
        for (let y = Math.max(0, flagY - 2); y <= Math.min(levelPlan.length - 1, flagY + 2); y++) {
            for (let x = Math.max(0, flagX - 2); x <= Math.min(levelPlan[y].length - 1, flagX + 2); x++) {
                if (levelPlan[y][x] === 'P') {
                    platformsAround++;
                }
            }
        }
        
        // More platforms around means harder to access
        return 1 - Math.min(platformsAround / 10, 0.9);
    }
    
    /**
     * Decision tree to select the best item based on game state
     */
    selectItem(playerItem: ItemType, levelPlan: string[], playerPos: PIXI.Point, aiPos: PIXI.Point, flagPos: PIXI.Point): ItemType {
        // Get remaining items
        const remainingItems = this.availableItems;
        console.log('Remaining items:', remainingItems);
        
        
        // Analyze current game state
        const gameState = this.analyzeGameState(levelPlan, playerPos, aiPos, flagPos);
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