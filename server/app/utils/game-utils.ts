import { isShrine } from '@common/utils/map.utils';
import { ActionOnTilePayload, Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { MapObjectType } from '@common/interfaces/map.interface';
import { SHRINE_BUFF_DURATION, SHRINE_BUFF_MULTIPLIER, SHRINE_TURN_LEFT } from '@common/types/game.constant';

const HALF_DOUBLE_NOTHING = 0.5;

export function giveShrineBuff(game: Game, player: Player, payload: ActionOnTilePayload): void {
    const tile = game.tiles[payload.position.y][payload.position.x];

    if (!tile || !isShrine(tile.mapObject)) {
        return;
    }

    const shrine = game.shrine.find(s => s.position.some(p => p.x === payload.position.x && p.y === payload.position.y));

    if (!shrine) {
        return;
    }

    let buffMultiplier = 1;

    if(payload.isDoubleOrNothing) {
        buffMultiplier = Math.random() < HALF_DOUBLE_NOTHING ? 0 : SHRINE_BUFF_MULTIPLIER;
    }

    if(shrine.objectType === MapObjectType.HealingShrine) {
        player.hp = Math.min(player.maxHp, player.hp + 2 * buffMultiplier);
    } else if(shrine.objectType === MapObjectType.CombatShrine) {
        player.attack = player.attack + 1 * buffMultiplier;
        player.defense = player.defense + 1 * buffMultiplier;
        player.shrineBuffs = {
            bonusAmount: buffMultiplier,
            turnsLeft: SHRINE_BUFF_DURATION,
        };
    }

    if(buffMultiplier === 0) {
        payload.DoubleOrNothingSuccess = false;
    } else if (buffMultiplier === SHRINE_BUFF_MULTIPLIER) {
        payload.DoubleOrNothingSuccess = true;
    }

    shrine.turnLeftDeactivated = SHRINE_TURN_LEFT;
}