import { Assets } from "pixi.js"
import { Config } from "../game/Config";
export class Loader {
  config: typeof Config;
  sprites: any[];
  resources: { [key: string]: any };

  constructor(config: typeof Config) {
    this.config = config;
    this.sprites = config.loader
    this.resources = {};
  }

  async preload() {
    try {
      await Promise.all(
        this.sprites.map(async (imagePath: string) => {
          if (!imagePath) {
            throw new Error("Invalid image path");
          }

          const texture = await Assets.load(imagePath);

          // Extract filename without extension for key
          let imageName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
          imageName = imageName.substring(0, imageName.lastIndexOf('.'));

          this.resources[imageName] = texture; // Store loaded textures
        })
      );
    } catch (error) {
      console.error("Error loading assets:", error);
    }
  }
}
