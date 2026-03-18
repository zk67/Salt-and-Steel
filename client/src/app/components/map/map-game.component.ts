import { Component, computed, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { getObjectDescription, movableTiles, TILE_ENERGY_COST } from '@app/utils/game-utils';
import {
    BattleWonPayload, DebugMovePayload,
    MovePlayerPayload,
    ToggleDebugPayload,
} from '@common/interfaces/game.interface';
import { MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { DIRECTION } from '@common/types/game.record';

const PLAYER_DIRECTION: Record<string, string> = {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
};

const DELAY_BEFORE_NAVIGATE_HOME = 5000; // 5 seconds

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

    tileType = TileType;
    mapObjectType = MapObjectType;

    contextMenu = signal<{ posX: number; posY: number; content: ContextMenuContent } | null>(null);
    isClientPlayerTurn = computed(() => this.gameService.isClientPlayerTurn());

    private handlePlayerMovePayloadBound = this.handlePlayerMovePayload.bind(this);
    private handleClickDebugPayloadBound = this.handleClickDebugPayload.bind(this);
    private handleGameOverBound = this.handleGameOver.bind(this);
    private handleToggleDebugModeBound = this.handleToggleDebugMode.bind(this);

    constructor(
        public mapService: MapService,
        public gameService: GameService,
        private readonly socketService: SocketClientService,
        private router: Router,
    ) {}

    // TODO: check si M vient de clavardage, const M a bouger lorsque permanent
    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent): void {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
            return;
        }
        if (event.key.toLowerCase() === 'm' && this.gameService.clientPlayer()?.isOrganizer) {
            this.gameService.setDebugMode(!this.gameService.isDebugMode());
            alert('Debug mode: ' + (this.gameService.isDebugMode() ? 'ON' : 'OFF'));
        }
    }

    private globalKeyUpListener = (event: KeyboardEvent) => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
            return;
        }
        const direction = PLAYER_DIRECTION[event.key.toLowerCase()];
        if (direction) {
            const player = this.gameService.clientPlayer();
            if (!player) return;
            this.handleMovePlayer(player, direction);
        }
    };

    async ngOnInit(): Promise<void> {
        this.socketService.on<MovePlayerPayload>('playerMoved', this.handlePlayerMovePayloadBound);
        this.socketService.on<DebugMovePayload>('handleClickDebug', this.handleClickDebugPayloadBound);
        this.socketService.on<{ winnerId: string }>('gameOver', this.handleGameOverBound);
        this.socketService.on<ToggleDebugPayload>('handleToggleDebugMode', this.handleToggleDebugModeBound);
        window.addEventListener('keyup', this.globalKeyUpListener);

        this.readyToLoad = true;
    }

    ngOnDestroy(): void {
        window.removeEventListener('keyup', this.globalKeyUpListener);
        this.socketService.off('playerMoved', this.handlePlayerMovePayloadBound);
        this.socketService.off('handleClickDebug', this.handleClickDebugPayloadBound);
        this.socketService.off('gameOver', this.handleGameOverBound);
        this.socketService.off('handleToggleDebugMode', this.handleToggleDebugModeBound);
    }

    getPlayerAt(x: number, y: number): Player | null {
        return this.gameService.players().find(p => p.x === x && p.y === y) || null;
    }

    getMovableTilesAt(x: number, y: number): boolean {
        const movable = this.gameService.actionTile();
        return movable[y] && movable[y][x] ? true : false;
    }

    getObjectDescription(objectType: number): string {
        return getObjectDescription(objectType);
    }

    private handleMovePlayer(player: Player, direction: string): void {
        const [dx, dy] = DIRECTION[direction];
        const newX = player.x + dx;
        const newY = player.y + dy;

        if (this.getMovableTilesAt(newX, newY)) {
            const payload: MovePlayerPayload = {
                playerId: player.id,
                direction,
            };

            this.socketService.send('movePlayer', payload);
        }
    }

    private handlePlayerMovePayload(payload: MovePlayerPayload) {
        const player = this.gameService.players().find(p => p.id === payload.playerId);
        if (!player) return;

        const [dx, dy] = DIRECTION[payload.direction];
        const newX = player.x + dx;
        const newY = player.y + dy;

        const tile = this.mapService.getTile(newX, newY);
        if (!tile) return;

        const updatedPlayer = {
            ...player, x: newX, y: newY,
            movementPoints: player.movementPoints - TILE_ENERGY_COST[tile.tileType],
        };

        this.gameService.updatePlayer(player.id, updatedPlayer);

        if (this.gameService.isClientPlayerTurn()) {
            this.gameService.actionTile.set(movableTiles(this.mapService.getTileMap(), updatedPlayer, this.gameService.getPlayers()));
        }
    }

    onTileClick(event: MouseEvent, x: number, y: number): void {
        if (event.button === 2) { // clique droit
            if (this.gameService.isDebugMode()) {
                this.debugClick(x, y);
            } else {
                this.showContextMenu(event, x, y);
            }
        } else if (event.button === 0 && this.gameService.getActionMode() && this.getMovableTilesAt(x, y)) { // clique gauche
            this.doActionAt(x, y);
        }
    }

    showContextMenu(event: MouseEvent, x: number, y: number): void {
        const player = this.getPlayerAt(x, y);
        const tile = this.mapService.getTile(x, y);

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
                    cost: TILE_ENERGY_COST[tile.tileType],
                },
            });
        }
    }

    doActionAt(x: number, y: number): void {
        const player = this.getPlayerAt(x, y);
        const clientPlayer = this.gameService.clientPlayer();

        if (clientPlayer) this.gameService.updatePlayer(clientPlayer.id, { actionsLeft: clientPlayer.actionsLeft - 1 });

        if (player) {
            this.killPlayer(player.id);
        } else {
            const mapObject = this.mapService.getMapObject(x, y);
            if (mapObject !== MapObjectType.None) {
                alert(`Action on object ${getObjectDescription(mapObject)} at (${x}, ${y})`);
            }
        }

        this.gameService.changeActionMode();
    }

    killPlayer(playerId: string): void {
        const player = this.gameService.players().find(p => p.id === playerId);
        const clientPlayer = this.gameService.clientPlayer();
        if (!player || !clientPlayer) return;

        alert(`Player ${player.name} has been killed!`);
        this.socketService.send('battleWon', { loserId: playerId, winnerId: clientPlayer.id } as BattleWonPayload);
        // Update player position + add victory send those info to server
    }

    debugClick(x: number, y: number): void {
        if (!this.gameService.isDebugMode()) return;

        const player = this.gameService.clientPlayer();
        if (!player) return;

        const tile = this.mapService.getTile(x, y);
        if (!tile ||
            tile.tileType === TileType.Wall ||
            this.getPlayerAt(x, y) ||
            tile.mapObject !== MapObjectType.None)
            return;

        const debugPayload: DebugMovePayload = {
            playerId: player.id,
            x,
            y,
        };

        this.socketService.send('debugMove', debugPayload);
    }

    handleClickDebugPayload(payload: DebugMovePayload): void {
        const player = this.gameService.players().find(p => p.id === payload.playerId);
        if (!player) return;

        const updatedPlayer: Player = { ...player, x: payload.x, y: payload.y };
        this.gameService.updatePlayer(player.id, updatedPlayer);

        this.gameService.actionTile.set(
            movableTiles(this.mapService.getTileMap(), updatedPlayer, this.gameService.getPlayers()),
        );
    }

    private handleGameOver(payload: { winnerId: string }): void {
        const winner = this.gameService.players().find(p => p.id === payload.winnerId);
        if (!winner) return;

        alert(`Game Over! The winner is ${winner.name}!`);
        setTimeout(() => {
            this.router.navigate(['/home']);
        }, DELAY_BEFORE_NAVIGATE_HOME);
    }

    private handleToggleDebugMode(payload: ToggleDebugPayload): void {
        this.gameService.setDebugMode(payload.debugMode);
        this.gameService.setHostId(payload.hostId);
    }
}
