import * as PIXI from "pixi.js";
import { App } from "../system/App";

export class UIPopup {
  container: PIXI.Container;
  headerText: PIXI.Text;
  bodyText: PIXI.Text;
  okButton: PIXI.Container;

  okButtonText: PIXI.Text;

  okAction?: () => void;
  cancelAction?: () => void;

  constructor(okAction?: () => void, cancelAction?: () => void) {
    this.container = this.createBackground();
    this.headerText = this.createHeader();
    this.bodyText = this.createBody();

    this.okAction = okAction;
    this.cancelAction = cancelAction;
    this.createButtons();
    const {
      okButton,
      okButtonText,
    } = this.createButtons();
    this.okButton = okButton;
    this.okButtonText = okButtonText;
  }

  createBackground() {
    this.container = new PIXI.Container();
    const background = new PIXI.Graphics();
    background.beginFill(0x2A107A, 0.8);
    background.drawRoundedRect(0, 0, 600, 300);
    background.endFill();
    this.container.addChild(background);
    this.container.zIndex = 1000;
    this.container.interactive = true;
    return this.container;
  }

  createHeader() {
    this.headerText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontSize: 25,
        fill: 0xFFFFFF,
        align: "center",
      }
    });
    this.headerText.position.set(300, 50);
    this.headerText.anchor.set(0.5, 0);
    this.container.addChild(this.headerText);
    return this.headerText;
  }

  createBody() {
    this.bodyText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontSize: 16,
        fill: 0xFFFFFF,
        align: "center",
      }
    });
    this.bodyText.position.set(300, 100);
    this.bodyText.anchor.set(0.5, 0);
    this.container.addChild(this.bodyText);
    return this.bodyText;
  }

  createButtons() {
    this.okButton = new PIXI.Container();
    const button = new PIXI.Graphics();
    button.beginFill(0x00AA00);
    button.drawRoundedRect(0, 0, 150, 50);
    button.endFill();

    this.okButtonText = new PIXI.Text({
      text: "Play",
      style: {
        fontFamily: "Arial",
        fontSize: 20,
        fill: 0xFFFFFF,
        align: "center",
      }
    });
    this.okButtonText.anchor.set(0.5, 0.5);
    this.okButtonText.position.set(75, 25);
    button.addChild(this.okButtonText);

    this.okButton.addChild(button);
    this.okButton.interactive = true;
    this.setOkAction(this.okAction);
    this.container.addChild(this.okButton);
    this.okButton.position.set(220, 220);

    return {
      okButton: this.okButton,
      okButtonText: this.okButtonText,
    };

  }

  setHeader(text: string) {
    this.headerText.text = text;
  }

  setBody(text: string) {
    this.bodyText.text = text;
  }

  setOkAction(action?: () => void) {
    this.okAction = action;
    this.okButton.on("pointerdown", () => {
      console.log("OK button clicked");
      this.okAction?.();
    });
  }

  setOkText(text: string) {
    this.okButtonText.text = text;
  }

  clearActions() {
    this.okAction = undefined;
    this.cancelAction = undefined;
    this.okButton.off("pointerdown");
  }

  hide() {
    this.container.visible = false;
  }
}



