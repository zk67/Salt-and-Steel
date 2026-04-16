import { ActionOnTilePayload, CombatPosture } from './game.interface';

export interface VirtualPlayerTurnResult {
    moved: boolean;
    startedCombat: boolean;
    attackerId?: string;
    defenderId?: string;
    posture?: CombatPosture;
    actionOnTile?: ActionOnTilePayload;
}