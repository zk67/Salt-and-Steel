import { MapData } from "@common/types/map.interface";
export interface Game {
    _id?: string,
    map: MapData;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    visible: boolean;
    imageUrl?: string;
}