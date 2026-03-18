import { MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';

export function createTile(type: TileType = TileType.Basic, mapObject: MapObjectType = MapObjectType.None): TileData {
    return { tileType: type, mapObject };
}
