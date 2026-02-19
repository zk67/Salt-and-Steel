import { MapObjectType, TileData, TileType } from '@common/types/map.interface';

export function createTile(type: TileType = TileType.Basic, mapObject: MapObjectType = MapObjectType.None): TileData {
    return { tileType: type, mapObject };
}
