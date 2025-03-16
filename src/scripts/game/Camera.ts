import Matter from 'matter-js';
import * as PIXI from 'pixi.js';
import { Background } from './Background';

export type TrackingFunction = (camera: Camera, target: Matter.Body) => PIXI.Rectangle;

export class Camera {
  // Determines how the camera will follow the player
  trackingFunction: TrackingFunction;
  shift: PIXI.Rectangle;
  state: PIXI.Point;

  bg!: Background;

  debugText = new PIXI.Text({
    style: {
      fontFamily: "Arial",
      fontSize: 20,
      fill: 0xffffff,
    },
    x: 100,
    y: 100,
    zIndex: 1000
  });


  constructor(
    trackingFunction: (camera: Camera, target: Matter.Body) => PIXI.Rectangle,
    bounds: PIXI.Rectangle,
    sceneContainer: PIXI.Container,
  ) {

    this.trackingFunction = trackingFunction;
    this.shift = bounds;
    this.state = new PIXI.Point(0, 0);

    this.createBackground(sceneContainer);

    this.debugText = sceneContainer.addChild(this.debugText);
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
      x: this.shift.x,
      y: this.shift.y
    }));
  }

  // Updates the camera position using the tracking function
  update(target: Matter.Body) {
    this.shift = this.trackingFunction(this, target);
    this.bg.move(new PIXI.Point(-this.shift.x, -this.shift.y));

    this.state.x -= this.shift.x;
    this.state.y -= this.shift.y;

    this.debugText.text = `
    x: ${this.shift.x}, y: ${this.shift.y}
    x: ${this.state.x}, y: ${this.state.y}
    `;
  }

  destroy() {
    this.bg.container.destroy();
  }

  static CenterFollow(camera: Camera, target: Matter.Body): PIXI.Rectangle {
    const x = -target.position.x + window.innerWidth / 2;
    const y = -target.position.y + window.innerHeight / 2;

    const shift = new PIXI.Rectangle(x, y, camera.shift.width, camera.shift.height);

    if (camera.state.x - shift.x < 0 ||
      camera.state.x - shift.x > camera.shift.width - window.innerWidth) {
      shift.x = 0;
    }

    if (camera.state.y - shift.y < 0 ||
      camera.state.y - shift.y > camera.shift.height - window.innerHeight) {
      shift.y = 0;
    }

    return shift;
  }
}

