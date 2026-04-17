import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { PlayableGame } from '@app/interface/game.interface';
import { VirtualPlayerService } from '@app/service/virtual-player/virtual-player.service';
import { ActionOnTilePayload } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType } from '@common/enums/map.enums';
import { Player, Profile } from '@common/interfaces/player.interface';
import { VirtualPlayerTurnResult } from '@common/interfaces/virtual-player.interface';
import { getVPTurnDelayMs } from '@common/types/player.constants';
import { equalPositions } from '@common/utils/map.utils';
import { generateUUID } from '@common/utils/general.utils';

type VirtualPlayerFlowActions = {
    doActionAtTile: (roomId: string, payload: ActionOnTilePayload) => boolean;
    nextPlayerTurn: (roomId: string) => void;
    startCombat: (roomId: string, attackerId: string, defenderId: string) => void;
    gameOver: (roomId: string, winnerId: string) => void;
};

export class VirtualPlayerFlowService {
    private readonly virtualPlayerService = new VirtualPlayerService();

    constructor(
        private readonly getGameByRoomId: (roomId: string) => PlayableGame | undefined,
        private readonly actions: VirtualPlayerFlowActions,
        private readonly broadcastService?: CurrentGameBroadcastService,
    ) {}

    addVirtualPlayer(roomId: string, profile: Profile): Player | null {
        const game = this.getGameByRoomId(roomId);
        if (!game) return null;
        if (game.players.length >= game._game.maxPlayers) return null;

        const id = `vp-${generateUUID()}`;
        const player = this.virtualPlayerService.createVirtualPlayer(id, profile, game.players);

        game.players.push(player);
        return player;
    }

    removeVirtualPlayer(roomId: string, playerId: string): boolean {
        const game = this.getGameByRoomId(roomId);
        if (!game) return false;

        const index = game.players.findIndex((player) => player.id === playerId && player.isVirtual);
        if (index === -1) return false;

        game.players.splice(index, 1);
        return true;
    }

    executeVirtualPlayerTurn(roomId: string, virtualPlayerId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game || game.activeCombat) return;

        const virtualPlayer = game.players.find((player) => player.id === virtualPlayerId && player.isVirtual);
        if (!virtualPlayer) return;

        const result = this.virtualPlayerService.decideTurn(virtualPlayer, game);

        this.handleMovement(roomId, virtualPlayer, result);

        if (this.startVirtualPlayerCombat(roomId, result)) {
            return;
        }

        this.handleAction(roomId, result);

        if (this.shouldAdvanceTurn(result)) {
            this.actions.nextPlayerTurn(roomId);
            return;
        }

        this.scheduleNextVirtualAction(roomId, virtualPlayer, game);
    }

    private handleMovement(roomId: string, virtualPlayer: Player, result: VirtualPlayerTurnResult): void {
        if (!result.moved) {
            return;
        }

        this.handleFlagPickup(roomId, virtualPlayer);
        this.broadcastService?.emitDebugMove(roomId, {
            playerId: virtualPlayer.id,
            targetPos: virtualPlayer.position,
        });
    }

    private startVirtualPlayerCombat(roomId: string, result: VirtualPlayerTurnResult): boolean {
        if (!result.startedCombat || !result.attackerId || !result.defenderId) {
            return false;
        }

        this.actions.startCombat(roomId, result.attackerId, result.defenderId);
        return true;
    }

    private handleAction(roomId: string, result: VirtualPlayerTurnResult): void {
        if (!result.actionOnTile) {
            return;
        }

        if (this.actions.doActionAtTile(roomId, result.actionOnTile)) {
            this.broadcastService?.emitActionOnTile(roomId, result.actionOnTile);
        }
    }

    private shouldAdvanceTurn(result: VirtualPlayerTurnResult): boolean {
        return !result.moved && !result.startedCombat && !result.actionOnTile;
    }

    private scheduleNextVirtualAction(roomId: string, virtualPlayer: Player, game: PlayableGame): void {
        if (game.turnOrder?.[game.currentTurnIndex] !== virtualPlayer.id) {
            return;
        }

        if (virtualPlayer.movementPoints > 0) {
            setTimeout(() => this.executeVirtualPlayerTurn(roomId, virtualPlayer.id), getVPTurnDelayMs());
            return;
        }

        this.actions.nextPlayerTurn(roomId);
    }

    private handleFlagPickup(roomId: string, virtualPlayer: Player): void {
        const game = this.getGameByRoomId(roomId);
        if (!game || game._game.gameMode !== GameMode.CTF) return;

        const tile = game._game.tiles[virtualPlayer.position.y][virtualPlayer.position.x];

        if (tile.mapObject === MapObjectType.Flag) {
            tile.mapObject = MapObjectType.None;
            virtualPlayer.hasFlag = true;

            this.broadcastService?.emitUpdateFlag(roomId, {
                playerId: virtualPlayer.id,
                flagStatus: true,
                position: virtualPlayer.position,
            });
        }

        if (
            tile.mapObject === MapObjectType.SpawnPoint &&
            equalPositions(game.spawnPoints?.get(virtualPlayer.id), virtualPlayer.position) &&
            virtualPlayer.hasFlag
        ) {
            virtualPlayer.hasFlag = false;
            this.actions.gameOver(roomId, virtualPlayer.id);
        }
    }
}
