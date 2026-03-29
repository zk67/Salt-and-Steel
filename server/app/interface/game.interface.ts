import { Game, TurnPhase, CombatPosture } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/utils/map.utils';

export interface PlayableGame {
    _game: Game;
    roomId: string;
    players: Player[];
    turnOrder?: string[];
    currentTurnIndex?: number;
    currentPhase?: TurnPhase;
    spawnPoints?: Map<string, Position>;
    idHost?: string;
    debugMode?: boolean;
    activeCombat?: {
        attackerId: string;
        defenderId: string;
        roundTimeSeconds: number;
        postures: Record<string, CombatPosture>;
    } | null;
}

export interface JoinableGameSummary {
    roomId: string;
    game: Game;
    playerCount: number;
}
