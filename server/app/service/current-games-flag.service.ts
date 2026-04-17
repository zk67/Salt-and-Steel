import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { PlayableGame } from '@app/interface/game.interface';
import { GameOverPayload, UpdateFlagPayload } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { equalPositions, Position } from '@common/utils/map.utils';
import { Logger } from '@nestjs/common';
import { MapObjectType, GameMode } from '@common/enums/map.enums';

type FlagMovementActions = {
    updateFlag: (roomId: string, payload: UpdateFlagPayload) => boolean;
    gameOver: (roomId: string, payload: GameOverPayload) => void;
};

export class CurrentGamesFlagService {
    constructor(private readonly broadcastService?: CurrentGameBroadcastService) {}

    handlePlayerMovement(
        roomId: string,
        game: PlayableGame,
        player: Player,
        position: Position,
        actions: FlagMovementActions,
    ): void {
        if (game._game.gameMode !== GameMode.CTF) return;

        const tile = game._game.tiles[position.y][position.x];
        if (tile.mapObject === MapObjectType.Flag) {
            tile.mapObject = MapObjectType.None;

            const payload = this.buildFlagPayload(player.id, position);
            actions.updateFlag(roomId, payload);
            this.broadcastService?.emitUpdateFlag(roomId, payload);

            Logger.log(`${player.name} picked up the flag in room ${roomId}.`);
        }

        if (this.isPlayerAtSpawnWithFlag(game, player, tile.mapObject, position)) {
            actions.gameOver(roomId, { winnerId: player.id, gameDurationSeconds: 0, endedByAbandon: false });
        }
    }

    private buildFlagPayload(playerId: string, position: Position): UpdateFlagPayload {
        return {
            playerId,
            flagStatus: true,
            position,
        };
    }

    private isPlayerAtSpawnWithFlag(game: PlayableGame, player: Player, tileObject: MapObjectType, position: Position): boolean {
        return tileObject === MapObjectType.SpawnPoint && equalPositions(game.spawnPoints?.get(player.id), position) && player.hasFlag;
    }
}
