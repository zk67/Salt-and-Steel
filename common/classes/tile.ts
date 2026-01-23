import { MapObjectType, TileType } from '../types/tile.types';

export class Tile {
    private tileType: TileType;
    private mapObject: MapObjectType;

    constructor(type: TileType = TileType.Basic, mapObject: MapObjectType = MapObjectType.None) {
        this.tileType = type;
        this.mapObject = mapObject;
    }

    // Voir si on veut garder ca ou pas
    getEnergyCost(): number {
        switch (this.tileType) {
            case TileType.Basic:
                return 1;
            case TileType.Ice:
                return 0;
            case TileType.Wall:
                return Infinity;
            case TileType.Door:
                return 1;
            case TileType.Water:
                return 2;
            default:
                return 1;
        }
    }

    getMapObject(): MapObjectType {
        return this.mapObject;
    }

    getTileType(): TileType {
        return this.tileType;
    }

    setMapObject(mapObject: MapObjectType): void {
        if(this.tileType !== TileType.Wall){
            this.mapObject = mapObject;
        }
    }

    setTileType(type: TileType): void {
        if(type !== this.tileType){
            this.tileType = type;

            if (type === TileType.Wall) {
                this.mapObject = MapObjectType.None;
            }
        }
    }
}

