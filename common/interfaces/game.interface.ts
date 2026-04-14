import { GameMode, Shrine, TileData } from '@common/interfaces/map.interface';
import { Position } from '@common/utils/map.utils';
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
    manipulatedDoors?: string[];
    usedShrines?: string[];
}

export interface MovePlayerPayload {
    playerId: string;
    direction: string;
}

export interface GameInfoPayload {
    players: Player[];
    game: Game;
    totalTurns?: number;
}

export interface NewTurnPayload {
    playerId: string;
    phase: TurnPhase;
    remainingSeconds?: number;
    totalTurns?: number;
}

export interface BattleWonPayload {
    loserId: string;
    winnerId: string;
    loserPos: Position;
    combatRound?: CombatRoundDetails;
    winnerHp: number;
    loserHp: number;
    remainingTurnSeconds?: number;
    gameDurationSeconds?: number;
    doubleKo?: boolean;
    attackerRespawn?: {
        playerId: string;
        position: Position;
        hp: number;
    };
    defenderRespawn?: {
        playerId: string;
        position: Position;
        hp: number;
    };
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
export interface ActiveCombatPayload {
    attackerId: string;
    defenderId: string;
    roundTimeSeconds: number;
}

export enum CombatPosture {
    None = 'none',
    Offensive = 'offensive',
    Defensive = 'defensive',
}
export interface SubmitCombatPosturePayload {
    posture: CombatPosture;
}

export interface ActionOnTilePayload {
    position: Position;
    playerId: string;
    isDoubleOrNothing: boolean;
    DoubleOrNothingSuccess?: boolean;
}


export interface PassFlagPayload {
    initiatorId: string;
    targetId: string;
}

export interface UpdateFlagPayload {
    playerId: string;
    flagStatus: boolean;
    position: Position;
}

export interface PassFlagPayload {
    initiatorId: string;
    targetId: string;
}

export interface UpdateFlagPayload {
    playerId: string;
    flagStatus: boolean;
    position: Position;
}


export interface PassFlagPayload {
    initiatorId: string;
    targetId: string;
}

export interface UpdateFlagPayload {
    playerId: string;
    flagStatus: boolean;
    position: Position;
}