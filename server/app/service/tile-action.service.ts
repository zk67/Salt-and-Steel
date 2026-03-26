import { MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { isTileDoor } from '@common/utils/map.utils';

export class TileActionService {
    applyAction(player: Player, tile: TileData): boolean {
        switch (tile.mapObject) {
            case MapObjectType.HealingShrine:
                player.hp = Math.min(player.maxHp, (player.hp || 0) + 2);
                player.actionsLeft = player.actionsLeft - 1;
                return true;
            case MapObjectType.CombatShrine:
                player.attack = (player.attack || 0) + 1;
                player.actionsLeft = player.actionsLeft - 1;
                return true;
            default:
                if (!isTileDoor(tile)) {
                    return false;
                }

                tile.tileType = tile.tileType === TileType.CloseDoor ? TileType.OpenDoor : TileType.CloseDoor;
                player.actionsLeft = player.actionsLeft - 1;
                return true;
        }
    }
}
