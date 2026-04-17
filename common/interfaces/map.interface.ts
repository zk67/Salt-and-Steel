import { MapObjectType, TileType } from "@common/enums/map.enums";
import { Position } from "@common/utils/map.utils";

export interface Shrine {
    objectType: MapObjectType;
    position: Position[];
    imageUrl: string[];
    turnLeftDeactivated: number;
}

export interface TileData {
    tileType: TileType;
    mapObject: MapObjectType;
}
