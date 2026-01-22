import { Tile, MapObjectType, TileType } from './tile';

export class MapObject {
    private tileMap: Tile[][];

    constructor(size: number) {
        this.tileMap = Array.from({ length: size }, () => Array.from({ length: size }, () => new Tile()));
    }

    getTileMap(): Tile[][] {
        return this.tileMap;
    }

    getSize(): number {
        return this.tileMap.length;
    }

    setTile(x: number, y: number, tile: TileType): void {
        this.tileMap[y][x].setTileType(tile);
    }

    getTile(x: number, y: number): Tile {
        return this.tileMap[y][x];
    }

    setMapObjectAt(x: number, y: number, mapObject: MapObjectType): void {
        this.tileMap[y][x].setMapObject(mapObject);
    }

    getMapObjectAt(x: number, y: number): MapObjectType {
        return this.tileMap[y][x].getMapObject();
    }
}

