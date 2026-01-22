import { TileType, MapObjectType } from './tile';
import { MapObject } from './map';

export class Tool {
    private tileType: TileType = TileType.Water;
    private mapObjectType: MapObjectType = MapObjectType.None;
    private toolType: ToolType = ToolType.Tile;
    private map: MapObject;

    constructor(map: MapObject) {
        this.map = map;
    }

    setTileType(type: TileType): void {
        this.toolType = ToolType.Tile;
        this.tileType = type;
    }

    setMapObjectType(type: MapObjectType): void {
        this.toolType = ToolType.Object;
        this.mapObjectType = type;
    }

    useTool(button: number, shiftKey: boolean, x: number, y: number): void {
        if (button === 0) {
            this.place(x, y);
        } else if (button === 2) {
            this.delete(x, y, shiftKey);
        }
    }

    place(x: number, y: number): void {
        const tile = this.map.getTile(x, y);

        if (this.toolType === ToolType.Tile) {
            if (this.tileType === TileType.Wall) {
                tile.setMapObject(MapObjectType.None);
            }

            tile.setTileType(this.tileType);
        } else if (this.mapObjectType !== MapObjectType.None) {
            if (tile.getMapObject() === MapObjectType.None && tile.getTileType() !== TileType.Wall) {
                tile.setMapObject(this.mapObjectType);
            }
        }
    }

    delete(x: number, y: number, shiftKeyPressed: boolean = false): void {
        if (shiftKeyPressed)
            this.map.setMapObject(x, y, MapObjectType.None);
        else
            this.map.setTile(x, y, TileType.Basic);
    }
}

export enum ToolType {
    Tile,
    Object
}


