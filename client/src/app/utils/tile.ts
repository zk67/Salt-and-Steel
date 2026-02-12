import { MapObjectType, TileData, TileType } from '@common/types/map.interface';

export function createTile(type: TileType = TileType.Basic, mapObject: MapObjectType = MapObjectType.None): TileData {
    return { tileType: type, mapObject };
}

export function getEnergyCost(tile: TileData): number {
    switch (tile.tileType) {
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
