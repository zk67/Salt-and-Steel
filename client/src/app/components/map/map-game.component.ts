import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';
import { GameService } from '@app/services/game.service';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { TimeService } from '@app/services/time.service';
import { TILE_ENERGY_COST, getObjectDescription, movableTiles } from '@app/utils/game-utils';
import { TIMER_TURN, TIMER_WAIT_TURN } from '@common/types/game.constant';
import { DebugMovePayload, GameInfoPayload, MovePlayerPayload, NewTurnPayload, TurnPhase } from '@common/types/game.interface';
import { DIRECTION } from '@common/types/game.record';
import { MapObjectType, MapSize, TileType } from '@common/types/map.interface';
import { Player } from '@common/types/player.interface';

const PLAYER_DIRECTION: Record<string, string> = {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
};

@Component({
    selector: 'app-map-game',
    templateUrl: './map-game.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapGameComponent implements OnInit, OnDestroy {
    gridSize: MapSize = MapSize.Small;
    readyToLoad = false;

    tileType = TileType;
    mapObjectType = MapObjectType;

    movableTilesMap = signal<boolean[][]>([]);
    isClientPlayerTurn = signal<boolean>(false);

    debugMode = false;

    constructor(
        public mapService: MapService,
        public gameService: GameService,
        private readonly socketService: SocketClientService,
        private readonly timeService: TimeService,
    ) {}

    // TODO: check si M vient de clavardage et seulement prendre de host, const M a bouger lorsque permanent
    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent): void {
        if (event.key.toLowerCase() === 'm') {
            this.debugMode = !this.debugMode;
            alert('Debug mode: ' + (this.debugMode ? 'ON' : 'OFF'));
        }
    }

    private globalKeyUpListener = (event: KeyboardEvent) => {
        const direction = PLAYER_DIRECTION[event.key.toLowerCase()];
        if (direction) {
            const player = this.gameService.clientPlayer();
            if (!player) return;
            this.handleMovePlayer(player, direction);
        }
    };

    async ngOnInit(): Promise<void> {
        this.socketService.on<NewTurnPayload>('newTurn', this.handleNewTurn.bind(this));
        this.socketService.on<MovePlayerPayload>('playerMoved', this.handlePlayerMovePayload.bind(this));
        this.socketService.on<GameInfoPayload>('gameStartInfo', this.handleStartGame.bind(this));
        this.socketService.on<DebugMovePayload>('handleClickDebug', this.handleClickDebugPayload.bind(this));
        window.addEventListener('keyup', this.globalKeyUpListener);

        this.readyToLoad = true;
    }

    ngOnDestroy(): void {
        window.removeEventListener('keyup', this.globalKeyUpListener);
    }

    getPlayerAt(x: number, y: number): Player | null {
        return this.gameService.players().find(p => p.x === x && p.y === y) || null;
    }

    getMovableTilesAt(x: number, y: number): boolean {
        const movable = this.movableTilesMap();
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
            energy: player.energy - TILE_ENERGY_COST[tile.tileType],
        };

        this.gameService.updatePlayer(player.id, updatedPlayer);

        if (this.isClientPlayerTurn()) {
            this.movableTilesMap.set(movableTiles(this.mapService.getTileMap(), updatedPlayer, this.gameService.getPlayers()));
        }
    }

    onTileClick(x: number, y: number): void {
        if (!this.debugMode) return;

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

        this.movableTilesMap.set(
            movableTiles(this.mapService.getTileMap(), updatedPlayer, this.gameService.getPlayers()),
        );
    }

    private handleNewTurn(newTurn: NewTurnPayload) {
        const player = this.gameService.clientPlayer();
        if (!player) return;

        if (newTurn.phase === TurnPhase.WaitTurn) {
            this.timeService.stopTimer();
            this.timeService.startTimer(TIMER_WAIT_TURN);

            if (newTurn.playerId === player.id) {
                this.isClientPlayerTurn.set(true);
                player.energy = player.speed ?? 0;
            } else {
                this.isClientPlayerTurn.set(false);
                player.energy = 0;
            }

            this.gameService.updatePlayer(player.id, player);
        } else {
            this.timeService.stopTimer();
            this.timeService.startTimer(TIMER_TURN);

            if (player.id === newTurn.playerId) {
                this.movableTilesMap.set(movableTiles(this.mapService.getTileMap(), player, this.gameService.getPlayers()));
            }
        }
    }

    // Probablement mettre cette fonction dans la waiting room pour initialiser en avance
    private handleStartGame(payload: GameInfoPayload): void {
        payload.players.forEach(p => {
            if (p.id !== this.gameService.clientPlayer()?.id) {
                this.gameService.addPlayer(p);
                alert(`Player ${p.name} has joined the game!`);
            }
        });

        this.mapService.loadFromDB(payload.game);
    }
}
