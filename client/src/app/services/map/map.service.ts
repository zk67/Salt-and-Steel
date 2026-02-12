import { Injectable } from '@angular/core';
import { createTile } from '@app/utils/tile';
import { GameMode, MapObjectType, TileData, TileType } from '@common/types/map.interface';
import { Game } from '@common/types/game.interface';
import { getMinMaxPlayers } from '@app/classes/game-utils';

@Injectable({
    providedIn: 'root',
})
export class MapService {
    private game: Game;
    private originalGame: Game | null = null;

    initializeMap(size: number, gameMode: GameMode = GameMode.Classic): void {
        this.game = {
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
        };
    }

    loadFromDB(gameData: Game): void {
        this.game = gameData;
        this.originalGame = structuredClone(gameData);
    }

    getGameData(): Game {
        return this.game;
    }

    getName(): string {
        if (!this.game) {
            return '';
        }

        return this.game.name;
    }

    setName(name: string): void {
        this.game.name = name;
    }

    getDescription(): string {
        if (!this.game) {
            return '';
        }

        return this.game.description;
    }

    setDescription(description: string): void {
        this.game.description = description;
    }

    getTileMap(): TileData[][] {
        return this.game.tiles;
    }

    getSize(): number {
        return this.game.size;
    }

    setTile(x: number, y: number, type: TileType): void {
        this.game.tiles[y][x].tileType = type;
    }

    getTile(x: number, y: number): TileData {
        return this.game.tiles[y][x];
    }

    setMapObject(x: number, y: number, mapObject: MapObjectType): void {
        this.game.tiles[y][x].mapObject = mapObject;
    }

    getMapObject(x: number, y: number): MapObjectType {
        return this.game.tiles[y][x].mapObject;
    }

    resetMap(): void {
        if (!this.originalGame) {
            this.initializeMap(this.game.size, this.game.gameMode);
        } else {
            this.game = structuredClone(this.originalGame);
        }
    }

    getVisibility(): boolean {
        return this.game.visible;
    }

    setVisibility(visible: boolean): void {
        this.game.visible = visible;
    }
}
