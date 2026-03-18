import { computed, Injectable, signal } from '@angular/core';
import { getMinMaxPlayers } from '@app/utils/game-utils';
import { createTile } from '@app/utils/tile';
import { Game } from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { Position } from '@common/utils/map.utils';
@Injectable({
    providedIn: 'root',
})
export class MapService {
    private gameSignal = signal<Game | null>(null);
    private originalGame: Game | null = null;

    // Signals pour les propriétés du jeu
    private tiles = computed(() => this.gameSignal()?.tiles ?? []);
    private name = computed(() => this.gameSignal()?.name ?? '');
    private description = computed(() => this.gameSignal()?.description ?? '');
    private size = computed(() => this.gameSignal()?.size ?? 0);
    private visible = computed(() => this.gameSignal()?.visible ?? false);
    private gameMode = computed(() => this.gameSignal()?.gameMode ?? GameMode.Classic);

    initializeMap(size: number, gameMode: GameMode = GameMode.Classic): void {
        this.gameSignal.set({
            name: '',
            description: '',
            size,
            gameMode,
            ...getMinMaxPlayers(size),
            tiles: Array.from({ length: size }, () =>
                Array.from({ length: size }, () => createTile()),
            ),
            visible: false,
            date: new Date(),
            imageUrl: '',
        });
    }

    loadFromDB(gameData: Game): void {
        this.gameSignal.set(gameData);
        this.originalGame = structuredClone(gameData);
    }

    getGameData(): Game | null {
        return this.gameSignal();
    }

    getName(): string {
        return this.name();
    }

    setName(name: string): void {
        this.gameSignal.update(game => game ? { ...game, name } : null);
    }

    getDescription(): string {
        return this.description();
    }

    getGameMode(): GameMode {
        return this.gameMode();
    }

    setDescription(description: string): void {
        this.gameSignal.update(game => game ? { ...game, description } : null);
    }

    getTileMap(): TileData[][] {
        return this.tiles();
    }

    getSize(): number {
        return this.size();
    }

    setTile(position: Position, type: TileType): void {
        this.gameSignal.update(game => {
            if (!game) return null;
            const updatedGame = { ...game };
            updatedGame.tiles[position.y][position.x].tileType = type;
            return updatedGame;
        });
    }

    getTile(position: Position): TileData | null {
        const game = this.gameSignal();
        return game?.tiles[position.y]?.[position.x] ?? null;
    }

    setMapObject(position: Position, mapObject: MapObjectType): void {
        this.gameSignal.update(game => {
            if (!game) return null;
            const updatedGame = { ...game };
            updatedGame.tiles[position.y][position.x].mapObject = mapObject;
            return updatedGame;
        });
    }

    getMapObject(position: Position): MapObjectType {
        const game = this.gameSignal();
        return game?.tiles[position.y]?.[position.x]?.mapObject ?? MapObjectType.None;
    }

    resetMap(): void {
        const game = this.gameSignal();
        if (!this.originalGame && game) {
            this.initializeMap(game.size, game.gameMode);
        } else if (this.originalGame) {
            this.gameSignal.set(structuredClone(this.originalGame));
        }
    }

    getVisibility(): boolean {
        return this.visible();
    }

    setVisibility(visible: boolean): void {
        this.gameSignal.update(game => game ? { ...game, visible } : null);
    }

    clearMapService(): void {
        this.gameSignal.set(null);
        this.originalGame = null;
    }
}
