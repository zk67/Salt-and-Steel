import { CombatPosture } from '@common/enums/game.enums';
import { ActionOnTilePayload } from './game.interface';

export interface VirtualPlayerTurnResult {
    moved: boolean;
    startedCombat: boolean;
    attackerId?: string;
    defenderId?: string;
    posture?: CombatPosture;
    actionOnTile?: ActionOnTilePayload;
}