import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { MapGameStateService } from '@app/services/game/map-game-state.service';
import { MapService } from '@app/services/map/map.service';
import { PopupService } from '@app/services/popup.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { canPassFlag, getObjectDescription } from '@app/utils/game-utils';
import { ActionOnTilePayload, DebugMovePayload, MovePlayerPayload, PassFlagPayload, ToggleDebugPayload } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { DIRECTION_STRING } from '@common/types/game.record';
import { GatewayEvents } from '@common/types/gateway.events';
import { addPositions, equalPositions, isTileDoor, Position, TILE_MOVEMENT_COST } from '@common/utils/map.utils';

const PLAYER_DIRECTION: Record<string, string> = {
    w: 'up', a: 'left', s: 'down', d: 'right',
};

const DELAY_BEFORE_NAVIGATE_HOME = 5000; // 5 seconds
const TIME_ROUND = 10;

export enum ContextMenuType {
    PlayerToolTip = 'player',
    Tile = 'tile',
}

interface ContextMenuContent {
    type: ContextMenuType;
    name?: string;
    imageUrl?: string;
    tileType?: string;
    cost?: number;
}

@Component({
    selector: 'app-map-game',
    templateUrl: './map-game.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapGameComponent implements OnInit, OnDestroy {
    readyToLoad = false;
    private readonly router = inject(Router);
    private readonly mapGameStateService = inject(MapGameStateService);

    gameMode = GameMode;
    tileType = TileType;
    mapObjectType = MapObjectType;

    contextMenu = signal<{ posX: number; posY: number; content: ContextMenuContent } | null>(null);
    isClientPlayerTurn = computed(() => this.gameService.isClientPlayerTurn());
    shrinePopupPosition = signal<Position | null>(null);

    private handlePlayerMovePayloadBound = this.handlePlayerMovePayload.bind(this);
    private handleClickDebugPayloadBound = this.handleClickDebugPayload.bind(this);
    private handleGameOverBound = this.handleGameOver.bind(this);
    private handleToggleDebugModeBound = this.handleToggleDebugMode.bind(this);
    private handleActionOnTileBound = this.handleActionOnTile.bind(this);

    constructor(
        public mapService: MapService,
        public gameService: GameService,
        private readonly socketService: SocketClientService,
        public popupService: PopupService,
    ) {}

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent): void {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
            return;
        }
        if (event.key.toLowerCase() === 'm' && this.gameService.clientPlayer()?.isOrganizer) {
            this.socketService.send(GatewayEvents.ToggleDebugMode, {});
        }
    }

    private globalKeyUpListener = (event: KeyboardEvent) => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) return;

        if (this.gameService.activeCombat()) return;

        const direction = PLAYER_DIRECTION[event.key.toLowerCase()];
        if (direction) {
            const player = this.gameService.clientPlayer();
            if (!player) return;
            this.handleMovePlayer(player, direction);
        }
    };

    async ngOnInit(): Promise<void> {
        this.socketService.on<MovePlayerPayload>(GatewayEvents.PlayerMoved, this.handlePlayerMovePayloadBound);
        this.socketService.on<DebugMovePayload>(GatewayEvents.HandleClickDebug, this.handleClickDebugPayloadBound);
        this.socketService.on<{ winnerId: string }>(GatewayEvents.GameOver, this.handleGameOverBound);
        this.socketService.on<ToggleDebugPayload>(GatewayEvents.HandleToggleDebugMode, this.handleToggleDebugModeBound);
        this.socketService.on<ActionOnTilePayload>(GatewayEvents.ActionOnTile, this.handleActionOnTileBound);
        window.addEventListener('keyup', this.globalKeyUpListener);

        this.readyToLoad = true;
    }

    ngOnDestroy(): void {
        window.removeEventListener('keyup', this.globalKeyUpListener);
        this.socketService.off(GatewayEvents.PlayerMoved, this.handlePlayerMovePayloadBound);
        this.socketService.off(GatewayEvents.HandleClickDebug, this.handleClickDebugPayloadBound);
        this.socketService.off(GatewayEvents.GameOver, this.handleGameOverBound);
        this.socketService.off(GatewayEvents.HandleToggleDebugMode, this.handleToggleDebugModeBound);
        this.socketService.off(GatewayEvents.ActionOnTile, this.handleActionOnTileBound);
    }

    getPlayerAt(position: Position): Player | null {
        return this.gameService.players().find(p => equalPositions(p.position, position) && !p.hasAbandoned) || null;
    }

    getMovableTilesAt(position: Position): boolean {
        const movable = this.gameService.actionTile();
        return movable[position.y] && movable[position.y][position.x] ? true : false;
    }

    getObjectDescription(objectType: number): string {
        return getObjectDescription(objectType);
    }

    private handleMovePlayer(player: Player, direction: string): void {
        if (this.gameService.activeCombat()) return;

        const directionVector = DIRECTION_STRING[direction];
        const newPosition: Position = addPositions(player.position, directionVector);

        if (this.getMovableTilesAt(newPosition)) {
            const payload: MovePlayerPayload = {
                playerId: player.id,
                direction,
            };

            this.socketService.send(GatewayEvents.MovePlayer, payload);
        }
    }

    private handlePlayerMovePayload(payload: MovePlayerPayload) {
        this.mapGameStateService.handlePlayerMovePayload(payload);

        if (this.gameService.isClientPlayerTurn() && !this.gameService.canPlayerStillDoAction()) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
        }
    }

    showContextMenu(event: MouseEvent, position: Position): void {
        const player = this.getPlayerAt(position);
        const tile = this.mapService.getTile(position);

        if (player) {
            this.contextMenu.set({
                posX: event.clientX,
                posY: event.clientY,
                content: { type: ContextMenuType.PlayerToolTip, name: player.name, imageUrl: player.imageUrl },
            });
        } else if (tile) {
            this.contextMenu.set({
                posX: event.clientX,
                posY: event.clientY,
                content: {
                    type: ContextMenuType.Tile,
                    tileType: this.tileType[tile.tileType],
                    cost: TILE_MOVEMENT_COST[tile.tileType],
                },
            });
        }
    }

    doActionAt(position: Position): void {
        if (this.gameService.activeCombat()) return;
        const player = this.getPlayerAt(position);
        const clientPlayer = this.gameService.clientPlayer();

        if (clientPlayer) this.gameService.updatePlayer(clientPlayer.id, { actionsLeft: clientPlayer.actionsLeft - 1 });
        else return;

        if (player) {
            if (canPassFlag(this.mapService.getGameMode(), clientPlayer, player)) {
                const payload: PassFlagPayload = {
                    initiatorId: clientPlayer.id,
                    targetId: player.id,
                };

                this.socketService.send(GatewayEvents.PassFlag, payload);
            } else {
                this.startCombat(player.id);
            }
        } else {
            const tile = this.mapService.getTile(position);
            if (!tile) return;
            switch (tile.mapObject) {
                case MapObjectType.Flag:
                    this.popupService.open(`Action sur le drapeau Ã  la position (${position.x}, ${position.y})`);
                    break;
                case MapObjectType.HealingShrine:
                case MapObjectType.CombatShrine:
                    const shrine = this.mapService.getShrineAtPosition(position);
                    if (!shrine) {
                        break;
                    }

                    if (shrine.turnLeftDeactivated > 0) {
                        this.popupService.open('Ce sanctuaire est temporairement desactive.');
                        break;
                    }

                    this.shrinePopupPosition.set(position);
                    break;
                case MapObjectType.None:
                    if (isTileDoor(tile) && !player) {
                        this.socketService.send(GatewayEvents.ActionOnTile, {position});
                    }
                    break;
            }
        }

        this.gameService.changeActionMode();
    }

    selectShrineChoice(isDoubleOrNothing: boolean): void {
        const position = this.shrinePopupPosition();
        if (!position) return;
        
        this.socketService.send(GatewayEvents.ActionOnTile, {position, isDoubleOrNothing});
        this.shrinePopupPosition.set(null);
    }

    startCombat(playerId: string): void {
        const player = this.gameService.players().find(p => p.id === playerId);
        const clientPlayer = this.gameService.clientPlayer();
        if (!player || !clientPlayer) return;

        this.gameService.clearCombatRound();
        this.socketService.send(GatewayEvents.StartCombat, {
            attackerId: clientPlayer.id,
            defenderId: playerId,
            roundTimeSeconds: TIME_ROUND,
        });
    }

    onTileClick(event: MouseEvent, position: Position): void {
        if (event.button === 2) {
            if (this.gameService.isDebugMode()) {
                this.debugClick(position);
            } else {
                this.showContextMenu(event, position);
            }
        } else if (event.button === 0 && this.gameService.getActionMode() && this.getMovableTilesAt(position)) {
            this.doActionAt(position);
        }
    }

    debugClick(position: Position): void {
        if (!this.gameService.isDebugMode()) return;

        if (this.gameService.getActionMode()) return;

        if (this.gameService.isWaitTurn()) return;

        if (this.gameService.activeCombat()) return;

        const player = this.gameService.clientPlayer();
        if (!player) return;

        const tile = this.mapService.getTile(position);
        if (!tile || tile.tileType === TileType.Wall || this.getPlayerAt(position) || tile.mapObject !== MapObjectType.None)
            return;

        const debugPayload: DebugMovePayload = {
            playerId: player.id,
            targetPos: position,
        };

        this.socketService.send(GatewayEvents.DebugMove, debugPayload);
    }

    handleClickDebugPayload(payload: DebugMovePayload): void {
        this.mapGameStateService.handleClickDebugPayload(payload);

        if (this.gameService.clientPlayer()?.id === payload.playerId && !this.gameService.canPlayerStillDoAction()) {
            this.socketService.send(GatewayEvents.EndTurnEarly);
        }
    }
    private handleGameOver(payload: { winnerId: string }): void {
        const winner = this.gameService.players().find(p => p.id === payload.winnerId);
        if (!winner) return;

        this.gameService.clearCombatState();
        this.mapGameStateService.updateVisitedTileStats();

        this.popupService.open(`Partie terminÃ©e ! Le gagnant est ${winner.name} !`);
        setTimeout(() => {
            this.popupService.close();
            this.router.navigate([APP_ROUTES.statistics]);
        }, DELAY_BEFORE_NAVIGATE_HOME);
    }

    private handleActionOnTile(payload: ActionOnTilePayload): void {
        this.mapGameStateService.handleActionOnTile(payload);
    }

    private handleToggleDebugMode(payload: ToggleDebugPayload): void {
        this.gameService.setDebugMode(payload.debugMode);
        this.gameService.setHostId(payload.hostId);
    }
}
