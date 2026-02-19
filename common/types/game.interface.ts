import { GameMode, TileData } from '@common/types/map.interface';

export interface Game {
    _id?: string;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    visible: boolean;
    imageUrl: string;
    date: Date;
    size: number;
    gameMode: GameMode;
    tiles: TileData[][];
}

export interface MovePlayerPayload {
    playerId: string;
    direction: string;
}
