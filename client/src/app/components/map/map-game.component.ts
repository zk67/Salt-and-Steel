import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Player } from '@app/interfaces/player.interface';
import { MapService } from '@app/services/map/map.service';
import { SaveService } from '@app/services/save.service';
import { TILE_ENERGY_COST, getObjectDescription, movableTiles } from '@app/utils/game-utils';
import { MapObjectType, MapSize, TileType } from '@common/types/map.interface';
import { firstValueFrom } from 'rxjs';

const DIRECTION: Record<string, [number, number]> = {
    w: [0, -1],
    a: [-1, 0],
    s: [0, 1],
    d: [1, 0],
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

    players = signal<Player[]>([]); // TODO: mettre la liste des joueurs dans un service pour la partager entre les composants
    movableTilesMap = signal<boolean[][]>([]);

    clientPlayer = computed(() =>
        this.players().find(p => p.id === '1') || null,
    );

    constructor(
        public mapService: MapService,
        private saveService: SaveService,
        private router: Router,
    ) {}

    private globalKeyUpListener = (event: KeyboardEvent) => {
        const direction = DIRECTION[event.key.toLowerCase()];
        if (direction) {
            const player = this.clientPlayer();
            if (!player) return;
            this.handleMovePlayer(player, player.x + direction[0], player.y + direction[1]);
        }
    };

    async ngOnInit(): Promise<void> {
        const id = '698e0c946cc0b3dcc5fe996a';

        if (id) {
            const game = await firstValueFrom(this.saveService.getGame(id));
            if (!game) {
                alert('Map introuvable, retour a la page principal.');
                this.router.navigate(['/home']);
                return;
            }

            this.gridSize = game.size;
            this.mapService.loadFromDB(game);
        } else {
            alert('Aucun ID de map fourni, retour a la page principal.');
            this.router.navigate(['/home']);
            return;
        }

        this.readyToLoad = true;

        // Temporary: create fake players until server integration
        this.players.set([
            { id: '1', name: 'Player 1', x: 5, y: 5, energy: 5, speed: 6, imageUrl: 'assets/avatars/avatar-1.png' },
            { id: '2', name: 'Player 2', x: 10, y: 10, energy: 5, speed: 6, imageUrl: 'assets/avatars/avatar-2.png' },
        ]);

        const player = this.clientPlayer();
        if (player) {
            this.movableTilesMap.set(movableTiles(this.mapService.getTileMap(), player));
        }

        window.addEventListener('keyup', this.globalKeyUpListener);
    }

    ngOnDestroy(): void {
        window.removeEventListener('keyup', this.globalKeyUpListener);
    }

    getPlayerAt(x: number, y: number): Player | null {
        return this.players().find(p => p.x === x && p.y === y) || null;
    }

    getMovableTilesAt(x: number, y: number): boolean {
        const movable = this.movableTilesMap();
        return movable[y] && movable[y][x] ? true : false;
    }

    getObjectDescription(objectType: number): string {
        return getObjectDescription(objectType);
    }

    private handleMovePlayer(player: Player, newX: number, newY: number): void {
        if (this.getMovableTilesAt(newX, newY)) {
            const tile = this.mapService.getTile(newX, newY);
            if (!tile) return;

            const updatedPlayer = { ...player, x: newX, y: newY,
                energy: player.energy - TILE_ENERGY_COST[tile.tileType] };

            this.players.update(players => {
                return players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
            });

            this.movableTilesMap.set(movableTiles(this.mapService.getTileMap(), updatedPlayer));
        }
    }
}
