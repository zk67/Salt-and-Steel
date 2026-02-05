import { Injectable } from '@angular/core';
import { createTile } from '@common/classes/tile';
import { GameMode, MapData, MapObjectType, TileData, TileType } from '@common/types/map.interface';
import { Game } from '@common/classes/game';

@Injectable({
    providedIn: 'root',
})
export class MapService {
    private mapData: MapData;
    private gameData: Game | null = null;

    initializeMap(size: number, gameMode: GameMode = GameMode.Classic): void {
        this.gameData = null;
        this.mapData = {
            name: '',
            description: '',
            size,
            gameMode,
            tiles: Array.from({ length: size }, () =>
                Array.from({ length: size }, () => createTile()),
            ),
            visible: false,
        };
    }

    loadFromDB(gameData: Game): void {
        this.gameData = gameData;
        this.mapData = structuredClone(gameData.map);
    }

    getGameData(): Game | null {
        return this.gameData;
    }

    getMapData(): MapData {
        return this.mapData;
    }

    getName(): string {
        return this.mapData.name;
    }

    setName(name: string): void {
        this.mapData.name = name;
    }

    getDescription(): string {
        return this.mapData.description;
    }

    setDescription(description: string): void {
        this.mapData.description = description;
    }

    getTileMap(): TileData[][] {
        return this.mapData.tiles;
    }

    getSize(): number {
        return this.mapData.size;
    }

    setTile(x: number, y: number, type: TileType): void {
        this.mapData.tiles[y][x].tileType = type;
    }

    getTile(x: number, y: number): TileData {
        return this.mapData.tiles[y][x];
    }

    setMapObject(x: number, y: number, mapObject: MapObjectType): void {
        this.mapData.tiles[y][x].mapObject = mapObject;
    }

    getMapObject(x: number, y: number): MapObjectType {
        return this.mapData.tiles[y][x].mapObject;
    }

    setGameMode(mode: GameMode): void {
        this.mapData.gameMode = mode;
    }

    getGameMode(): GameMode {
        return this.mapData.gameMode;
    }

    resetMap(): void {
        if (!this.gameData) {
            this.initializeMap(this.mapData.size, this.mapData.gameMode);
        } else {
            this.mapData = structuredClone(this.gameData.map);
        }
    }

    getVisibility(): boolean {
        return this.mapData.visible;
    }

    setVisibility(visible: boolean): void {
        this.mapData.visible = visible;
    }
}
