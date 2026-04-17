import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { PlayableGame } from '@app/interface/game.interface';
import { VirtualPlayerService } from '@app/service/virtual-player/virtual-player.service';
import { ActionOnTilePayload } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType } from '@common/interfaces/map.interface';
import { Player, Profile } from '@common/interfaces/player.interface';
import { VirtualPlayerTurnResult } from '@common/interfaces/virtual-player.interface';
import { getVPTurnDelayMs } from '@common/types/player.constants';
import { equalPositions } from '@common/utils/map.utils';
import { generateUUID } from '@common/utils/general.utils';

export class VirtualPlayerFlowService {
    private readonly virtualPlayerService = new VirtualPlayerService();

    constructor(
        private readonly getGameByRoomId: (roomId: string) => PlayableGame | undefined,
        private readonly doActionAtTile: (roomId: string, payload: ActionOnTilePayload) => boolean,
        private readonly nextPlayerTurn: (roomId: string) => void,
        private readonly startCombat: (roomId: string, attackerId: string, defenderId: string) => void,
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

    executeVirtualPlayerTurn(roomId: string, vpId: string): void {
        const game = this.getGameByRoomId(roomId);
        if (!game || game.activeCombat) return;

        const vp = game.players.find((player) => player.id === vpId && player.isVirtual);
        if (!vp) return;

        const result = this.virtualPlayerService.decideTurn(vp, game);

        this.handleMovement(roomId, vp, result);

        if (this.startVirtualPlayerCombat(roomId, result)) {
            return;
        }

        this.handleAction(roomId, result);

        if (this.shouldAdvanceTurn(result)) {
            this.nextPlayerTurn(roomId);
            return;
        }

        this.scheduleNextVirtualAction(roomId, vp, game);
    }

    private handleMovement(roomId: string, vp: Player, result: VirtualPlayerTurnResult): void {
        if (!result.moved) {
            return;
        }

        this.handleFlagPickup(roomId, vp);
        this.broadcastService?.emitDebugMove(roomId, {
            playerId: vp.id,
            targetPos: vp.position,
        });
    }

    private startVirtualPlayerCombat(roomId: string, result: VirtualPlayerTurnResult): boolean {
        if (!result.startedCombat || !result.attackerId || !result.defenderId) {
            return false;
        }

        this.startCombat(roomId, result.attackerId, result.defenderId);
        return true;
    }

    private handleAction(roomId: string, result: VirtualPlayerTurnResult): void {
        if (!result.actionOnTile) {
            return;
        }

        if (this.doActionAtTile(roomId, result.actionOnTile)) {
            this.broadcastService?.emitActionOnTile(roomId, result.actionOnTile);
        }
    }

    private shouldAdvanceTurn(result: VirtualPlayerTurnResult): boolean {
        return !result.moved && !result.startedCombat && !result.actionOnTile;
    }

    private scheduleNextVirtualAction(roomId: string, vp: Player, game: PlayableGame): void {
        if (game.turnOrder?.[game.currentTurnIndex] !== vp.id) {
            return;
        }

        if (vp.movementPoints > 0) {
            setTimeout(() => this.executeVirtualPlayerTurn(roomId, vp.id), getVPTurnDelayMs());
            return;
        }

        this.nextPlayerTurn(roomId);
    }

    private handleFlagPickup(roomId: string, vp: Player): void {
        const game = this.getGameByRoomId(roomId);
        if (!game || game._game.gameMode !== GameMode.CTF) return;

        const tile = game._game.tiles[vp.position.y][vp.position.x];

        if (tile.mapObject === MapObjectType.Flag) {
            tile.mapObject = MapObjectType.None;
            vp.hasFlag = true;

            this.broadcastService?.emitUpdateFlag(roomId, {
                playerId: vp.id,
                flagStatus: true,
                position: vp.position,
            });
        }

        if (
            tile.mapObject === MapObjectType.SpawnPoint &&
            equalPositions(game.spawnPoints?.get(vp.id), vp.position) &&
            vp.hasFlag
        ) {
            vp.hasFlag = false;
            this.broadcastService?.emitGameOver(roomId, vp.id);
        }
    }
}
