import { MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';

export function createTile(type: TileType = TileType.Basic, mapObject: MapObjectType = MapObjectType.None): TileData {
    return { tileType: type, mapObject };
}

export function getShrineImageUrl(type: MapObjectType, index: number): string {
    const baseUrl = '../../../assets/objects/';
    switch (type) {
        case MapObjectType.HealingShrine:
            return `${baseUrl}heal${index}.png`;
        case MapObjectType.CombatShrine:
            return `${baseUrl}combat${index}.png`;
        default:
            return '';
    }
}
