import * as PIXI from "pixi.js";
import { ItemType } from "../ai/ItemSelector";

export class ItemButton {
  button!: PIXI.Container;
  bg!: PIXI.Graphics;

  constructor(item: ItemType, i: number) {
    this.button = new PIXI.Container();
    this.button.x = (window.innerWidth / 2 - 250 + i * 250);
    this.button.y = 150;
    this.bg = new PIXI.Graphics();
    this.bg.beginFill(0x333333);
    this.bg.lineStyle(2, 0x666666);
    this.bg.drawRoundedRect(0, 0, 200, 150, 10);
    this.bg.endFill();
    this.button.addChild(this.bg);
    this.bg.eventMode = 'static';
    this.bg.cursor = 'pointer';

    const itemNames = ["Platform", "Bomb", "Spikes"];
    const itemDescriptions = [
      "Add a 3-tile platform to help you reach the flag",
      "Remove a 3-tile platform (cannot remove flag platform)",
      "Place spikes on a platform to trap your opponent"
    ];

    // TODO: place this in a more ideal location on the screen.
    const icon = new PIXI.Graphics();
    let itemName = "";
    let itemDescription = "";
    switch (item) {
      case ItemType.Platform:
        icon.beginFill(0x995533);
        icon.drawRect(50, 50, 100, 20);
        icon.endFill();
        itemName = itemNames[0];
        itemDescription = itemDescriptions[0];
        break;
      case ItemType.Bomb:
        icon.beginFill(0x333333);
        icon.lineStyle(2, 0xff0000);
        icon.drawCircle(100, 60, 25);
        icon.endFill();
        itemName = itemNames[1];
        itemDescription = itemDescriptions[1];
        break;
      case ItemType.Spikes:
        icon.beginFill(0xaaaaaa);
        for (let j = 0; j < 5; j++) {
          icon.moveTo(40 + j * 20, 70);
          icon.lineTo(50 + j * 20, 40);
          icon.lineTo(60 + j * 20, 70);
        }
        icon.endFill();
        itemName = itemNames[2];
        itemDescription = itemDescriptions[2];
        break;
    }
    this.button.addChild(icon);


    const itemText = new PIXI.Text({
      text: itemName,
      style: {
        fontFamily: "Arial",
        fontSize: 20,
        fill: 0xffffff,
        align: "center"
      }
    });
    itemText.anchor.set(0.5, 0);
    itemText.position.set(100, 20);
    this.button.addChild(itemText);

    // Item description
    const descText = new PIXI.Text({
      text: itemDescription,
      style: {
        fontFamily: "Arial",
        fontSize: 12,
        fill: 0xcccccc,
        align: "center",
        wordWrap: true,
        wordWrapWidth: 180
      }
    });
    descText.anchor.set(0.5, 0);
    descText.position.set(100, 100);
    this.button.addChild(descText);
  }

}
