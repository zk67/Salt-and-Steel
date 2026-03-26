import { Injectable, signal } from '@angular/core';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { GatewayEvents } from '@common/types/gateway.events';
import { canMoveToTile, getActionableTiles, getNeighborPositions, isValidTile, movableTiles } from '@common/utils/map.utils';
import { NewTurnPayload, TurnPhase } from '@common/interfaces/game.interface';
import { GamePlayerStateService } from './game-player-state.service';
import { TimeService } from './time.service';

@Injectable({
    providedIn: 'root',
})
export class GameTurnService {
    readonly actionTile = signal<boolean[][]>([]);
    readonly isClientPlayerTurn = signal<boolean>(false);
    readonly isWaitTurn = signal<boolean>(false);

    private actionMode = false;

    constructor(
        private readonly mapService: MapService,
        private readonly playerState: GamePlayerStateService,
        private readonly socketService: SocketClientService,
        private readonly timeService: TimeService,
    ) {}

    getActionMode(): boolean {
        return this.actionMode;
    }

    changeActionMode(): void {
        const player = this.playerState.clientPlayer();
        const tiles = this.mapService.getTileMap();

        if (!player || tiles.length === 0) {
            return;
        }

        this.actionMode = !this.actionMode;

        if (!this.canPlayerStillDoAction()) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
            return;
        }

        if (this.actionMode) {
            this.actionTile.set(getActionableTiles(tiles, player, this.playerState.getPlayers()));
        } else {
            this.actionTile.set(movableTiles(tiles, player, this.playerState.getPlayers()));
        }
    }

    handleNewTurn(newTurn: NewTurnPayload): void {
        const player = this.playerState.clientPlayer();
        if (!player) {
            return;
        }

        if (newTurn.phase === TurnPhase.WaitTurn) {
            this.isWaitTurn.set(true);
            this.timeService.stopTimer();
            this.timeService.startTimer(TIMER_WAIT_TURN);
            this.playerState.setActivePlayer(newTurn.playerId);
            this.actionTile.set([]);
            this.actionMode = false;

            if (newTurn.playerId === player.id) {
                this.isClientPlayerTurn.set(true);
                this.playerState.updatePlayer(player.id, {
                    movementPoints: player.speed ?? 0,
                    actionsLeft: 1,
                });
            } else {
                this.isClientPlayerTurn.set(false);
                this.playerState.updatePlayer(player.id, {
                    movementPoints: 0,
                    actionsLeft: 0,
                });
            }

            return;
        }

        this.isWaitTurn.set(false);
        this.timeService.stopTimer();
        this.timeService.startTimer(TIMER_TURN);

        if (player.id !== newTurn.playerId) {
            return;
        }

        if (!this.canPlayerStillDoAction()) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
        } else {
            this.actionTile.set(movableTiles(this.mapService.getTileMap(), player, this.playerState.getPlayers()));
        }
    }

    canPlayerStillDoAction(): boolean {
        const player = this.playerState.clientPlayer();
        if (!player) {
            return false;
        }

        const tiles = this.mapService.getTileMap();
        const possibleActionTiles = getActionableTiles(tiles, player, this.playerState.getPlayers());

        for (const possiblePosition of getNeighborPositions(player.position)) {
            if (!isValidTile(tiles, possiblePosition)) {
                continue;
            }

            if (player.actionsLeft > 0 && possibleActionTiles[possiblePosition.y][possiblePosition.x]) {
                return true;
            }

            if (
                canMoveToTile(
                    tiles,
                    this.playerState.getPlayers(),
                    { ...player.position, movementPoints: player.movementPoints },
                    possiblePosition,
                ) !== null
            ) {
                return true;
            }
        }

        return false;
    }

    clear(): void {
        this.actionTile.set([]);
        this.isClientPlayerTurn.set(false);
        this.isWaitTurn.set(false);
        this.actionMode = false;
    }
}
