import { PlatformLocation } from '@angular/common';
import { computed, Injectable, signal } from '@angular/core';
import { getMinMaxPlayers } from '@app/utils/game-utils';
import { createTile, getShrineImageUrl } from '@app/utils/tile';
import { ActionOnTilePayload, Game } from '@common/interfaces/game.interface';
import { Shrine, TileData} from '@common/interfaces/map.interface';
import { MapObjectType, TileType, GameMode } from '@common/enums/map.enums';
import { isShrine, Position } from '@common/utils/map.utils';
@Injectable({
    providedIn: 'root',
})
export class MapService {
    private gameSignal = signal<Game | null>(null);
    private originalGame: Game | null = null;
    private readonly baseHref: string;

    // Signals pour les propriétés du jeu
    private tiles = computed(() => this.gameSignal()?.tiles ?? []);
    private name = computed(() => this.gameSignal()?.name ?? '');
    private description = computed(() => this.gameSignal()?.description ?? '');
    private size = computed(() => this.gameSignal()?.size ?? 0);
    private visible = computed(() => this.gameSignal()?.visible ?? false);
    private gameMode = computed(() => this.gameSignal()?.gameMode ?? GameMode.Classic);

    constructor(platformLocation: PlatformLocation) {
        const rawBaseHref = platformLocation.getBaseHrefFromDOM() || '/';
        this.baseHref = rawBaseHref.endsWith('/') ? rawBaseHref : `${rawBaseHref}/`;
    }

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
            shrine: [],
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

    addShrine(shrine: Shrine): void {
        this.gameSignal.update(game => {
            if (!game) return null;
            return {
                ...game,
                shrine: [...(game.shrine ?? []), shrine],
            };
        });
    }

    removeShrineByPosition(position: Position): Shrine | null {
        let removedShrine: Shrine | null = null;

        this.gameSignal.update(game => {
            if (!game) return null;

            const shrine = this.getShrineAtPosition(position);
            if (!shrine) {
                return game;
            }

            removedShrine = shrine;
            return {
                ...game,
                shrine: game.shrine.filter((s) => s !== shrine),
            };
        });

        return removedShrine;
    }

    getShrineAtPosition(position: Position): Shrine | null {
        const game = this.gameSignal();
        return game?.shrine.find((s) => s.position.some((p) => p.x === position.x && p.y === position.y)) ?? null;
    }

    updateShrine(shrine: Shrine, payload?: ActionOnTilePayload | null): void {
        if (payload) {
            this.addUsedShrine(payload.position);
        }
        this.gameSignal.update(game => {
            if (!game) return null;
            return {
                ...game,
                shrine: game.shrine.map(s => s === shrine ? shrine : s),
            };
        });
    }

    addManipulatedDoor(position: Position): void {
        this.gameSignal.update(game => {
            if (!game) return null;
            const posStr = `${position.x},${position.y}`;
            const manipulated = new Set(game.manipulatedDoors ?? []);
            manipulated.add(posStr);
            return { ...game, manipulatedDoors: Array.from(manipulated) };
        });
    }

    getManipulatedDoors(): string[] {
        const game = this.gameSignal();
        return game?.manipulatedDoors ?? [];
    }

    getTotalDoors(): number {
        return this.getTileMap()
            .flat()
            .filter((tile) => tile.tileType === TileType.CloseDoor || tile.tileType === TileType.OpenDoor)
            .length;
    }

    addUsedShrine(position: Position): void {
        this.gameSignal.update(game => {
            if (!game) return null;
            const shrines = game.shrine ?? [];
            const index = shrines.findIndex(s => s.position.some(p => p.x === position.x && p.y === position.y));
            if (index === -1) return game;
            const used = new Set(game.usedShrines ?? []);
            used.add(index.toString());
            return { ...game, usedShrines: Array.from(used) };
        });
    }

    getUsedShrines(): string[] {
        const game = this.gameSignal();
        return game?.usedShrines ?? [];
    }

    getTotalShrines(): number {
        const shrines = this.gameSignal()?.shrine ?? [];
        return shrines.length;
    }

    getShrineBackgroundImage(position: Position): string | null {
        const tile = this.getTile(position);
        if (!tile || !isShrine(tile.mapObject)) {
            return null;
        }

        const shrine = this.getShrineAtPosition(position);
        if (!shrine) {
            return null;
        }

        const index = shrine.position.findIndex((pos) => Number(pos.x) === position.x && Number(pos.y) === position.y);
        if (index === -1) {
            return null;
        }

        const shrineImage = shrine.imageUrl?.[index] ?? getShrineImageUrl(shrine.objectType, index + 1);
        if (!shrineImage) {
            return null;
        }

        return `url(${this.normalizeShrineImageUrl(shrineImage)})`;
    }

    private normalizeShrineImageUrl(imageUrl: string): string {
        const trimmedImageUrl = imageUrl.trim();
        const urlMatch = trimmedImageUrl.match(/^url\((.*)\)$/i);
        const rawPath = urlMatch ? urlMatch[1].trim().replace(/^['"]|['"]$/g, '') : trimmedImageUrl;

        if (rawPath.startsWith('http://') || rawPath.startsWith('https://') || rawPath.startsWith('data:')) {
            return rawPath;
        }

        const assetsPath = rawPath
            .replace(/^\.\//, '')
            .replace(/^\/+/, '')
            .replace(/^(\.\.\/)+assets\//, 'assets/');

        if (!assetsPath.startsWith('assets/')) {
            return rawPath;
        }

        return `${this.baseHref}${assetsPath}`;
    }
}
