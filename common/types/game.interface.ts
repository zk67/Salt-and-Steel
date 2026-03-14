import { GameMode, TileData } from '@common/types/map.interface';
import { Player } from './player.interface';

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

export interface GameInfoPayload {
    players: Player[];
    game: Game;
}

export interface NewTurnPayload {
    playerId: string;
    phase: TurnPhase;
}

export interface BattleWonPayload {
    loserId: string;
    winnerId: string;
    loserPos: {
        x: number;
        y: number;
    };
}

export enum TurnPhase {
    WaitTurn,
    Turn,
}

export interface DebugMovePayload {
    playerId: string;
    x: number;
    y: number;
}

export interface ToggleDebugPayload {
    debugMode: boolean;
    hostId: string;
}