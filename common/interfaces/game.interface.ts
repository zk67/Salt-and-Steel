import { Position } from '@common/utils/map.utils';
import { GameMode, TileData, Shrine } from '@common/interfaces/map.interface';
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
    shrine: Shrine[];
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
    loserPos: Position;
    combatRound?: CombatRoundDetails;
    winnerHp: number;
    loserHp: number;
}

export enum TurnPhase {
    WaitTurn,
    Turn,
}

export interface DebugMovePayload {
    playerId: string;
    targetPos: Position;
}

export interface ToggleDebugPayload {
    debugMode: boolean;
    hostId: string;
}
export interface CombatParticipantRoundDetails {
    playerId: string;
    playerName: string;
    attack: CombatStatBreakdown;
    defense: CombatStatBreakdown;
    damageDealt: number;
    damageTaken: number;
}
export interface CombatRoundDetails {
    attacker: CombatParticipantRoundDetails;
    defender: CombatParticipantRoundDetails;
}
export interface CombatStatBreakdown {
    baseValue: number;
    postureBonus: number;
    diceResult: number;
    penalty: number;
    total: number;
}