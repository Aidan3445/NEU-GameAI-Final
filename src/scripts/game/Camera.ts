import Matter from 'matter-js';
import * as PIXI from 'pixi.js';
import { Background } from './Background';

export type TrackingFunction = (camera: Camera, target: Matter.Body) => PIXI.Rectangle;

export class Camera {
  // Determines how the camera will follow the player
  trackingFunction: TrackingFunction;
  state: PIXI.Rectangle;
  max: PIXI.Point;

  bg!: Background;


  constructor(
    trackingFunction: (camera: Camera, target: Matter.Body) => PIXI.Rectangle,
    width: number,
    height: number,
    bounds: PIXI.Point,
    sceneContainer: PIXI.Container
  ) {
    this.trackingFunction = trackingFunction;
    this.state = new PIXI.Rectangle(0, 0, width, height);
    this.max = bounds;

    this.createBackground(sceneContainer);
  }

  createBackground(sceneContainer: PIXI.Container) {
    this.bg = new Background();
    sceneContainer.addChild(this.bg.container);
  }

  setTrackingFunction(trackingFunction: TrackingFunction) {
    this.trackingFunction = trackingFunction;
  }

  // Moves the target based on the camera state/position
  apply(target: Matter.Body) {
    Matter.Body.setPosition(target, Matter.Vector.add(target.position, {
      x: this.state.x,
      y: this.state.y
    }));
  }

  // Updates the camera position using the tracking function
  update(target: Matter.Body) {
    const newState = this.trackingFunction(this, target);
    this.state = newState;
    this.bg.move(new PIXI.Point(-this.state.x, -this.state.y));
  }

  static CenterFollow(camera: Camera, target: Matter.Body): PIXI.Rectangle {
    const state = camera.state;
    const targetX = -target.position.x + state.width / 2;
    const targetY = -target.position.y + state.height / 2;

    // Smoothly interpolate the camera position
    state.x += (targetX - state.x) * 0.9;
    state.y += (targetY - state.y) * 0.9;

    return state;
  }
}

