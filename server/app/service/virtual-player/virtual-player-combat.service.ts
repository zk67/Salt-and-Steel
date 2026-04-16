import { CombatPosture } from '@common/interfaces/game.interface';
import { Player, Profile } from '@common/interfaces/player.interface';

export class VirtualPlayerCombatService {

    getCombatPosture(vp: Player): CombatPosture {
        return vp.virtualProfile === Profile.Aggressive
            ? CombatPosture.Offensive
            : CombatPosture.Defensive;
    }
}