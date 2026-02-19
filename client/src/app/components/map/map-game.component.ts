import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Player } from '@common/types/player.interface';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { TILE_ENERGY_COST, getObjectDescription, movableTiles } from '@app/utils/game-utils';
import { MovePlayerPayload } from '@common/types/game.interface';
import { DIRECTION } from '@common/types/game.record';
import { MapObjectType, MapSize, TileType } from '@common/types/map.interface';
import { GameService } from '@app/services/game.service';

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
    isClientPlayerTurn = signal<boolean>(true);

    constructor(
        public mapService: MapService,
        public gameService: GameService,
        private router: Router,
        private readonly socketService: SocketClientService,
    ) {}

    private globalKeyUpListener = (event: KeyboardEvent) => {
        const direction = PLAYER_DIRECTION[event.key.toLowerCase()];
        if (direction) {
            const player = this.gameService.clientPlayer();
            if (!player) return;
            this.handleMovePlayer(player, direction);
        }
    };

    async ngOnInit(): Promise<void> {
        const game = this.gameService.game();

        if (game) {
            this.mapService.loadFromDB(game);
            this.gridSize = game.size as MapSize;
        } else {
            this.router.navigate(['/home']);
            return;
        }

        // Temporary: create fake players until server integration
        this.gameService.addPlayer({
            id: '1',
            name: 'Player 1',
            x: 5,
            y: 5,
            energy: 5,
            speed: 6,
            imageUrl: 'assets/avatars/avatar-1.png',
        });
        this.gameService.addPlayer({
            id: '2',
            name: 'Player 2',
            x: 10,
            y: 10,
            energy: 5,
            speed: 6,
            imageUrl: 'assets/avatars/avatar-2.png',
        });

        const player = this.gameService.clientPlayer();
        if (player) {
            this.movableTilesMap.set(movableTiles(this.mapService.getTileMap(), player));
        }

        this.socketService.on<MovePlayerPayload>('playerMoved', this.handlePlayerMovePayload.bind(this));
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

        const updatedPlayer = { ...player, x: newX, y: newY,
            energy: player.energy - TILE_ENERGY_COST[tile.tileType] };

        this.gameService.updatePlayer(player.id, updatedPlayer);

        if(this.isClientPlayerTurn()) {
            this.movableTilesMap.set(movableTiles(this.mapService.getTileMap(), updatedPlayer));
        }
    }
}
