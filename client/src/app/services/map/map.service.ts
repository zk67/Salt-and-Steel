import { Injectable } from '@angular/core';
import { createTile } from '@common/classes/tile';
import { GameMode, MapData, MapObjectType, TileData, TileType } from '@common/types/map.interface';

@Injectable({
    providedIn: 'root',
})
export class MapService {
    private tileMap: TileData[][] = [];
    private gameMode: GameMode = GameMode.Classic;
    private size: number = 0; // Voir si necessaire de garder size
    private mapId: string = '';
    private name: string = '';
    private description: string = '';

    initializeMap(size: number): void {
        this.size = size;
        this.mapId = ''; // On peut potentiellement juste utiliser le nom a la place d'un id, car les noms sont uniques
        this.name = '';
        this.description = '';
        this.tileMap = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => createTile()),
        );
    }

    loadFromDB(data: MapData): void {
        this.mapId = data.id;
        this.name = data.name;
        this.description = data.description;
        this.size = data.size;
        this.gameMode = data.gameMode;
        this.tileMap = data.tiles;
    }

    getMapData(): MapData {
        return {
            id: this.mapId,
            name: this.name,
            description: this.description,
            size: this.size,
            gameMode: this.gameMode,
            tiles: this.tileMap,
        };
    }

    getMapId(): string {
        return this.mapId;
    }

    setMapId(id: string): void {
        this.mapId = id;
    }

    getName(): string {
        return this.name;
    }

    setName(name: string): void {
        this.name = name;
    }

    getDescription(): string {
        return this.description;
    }

    setDescription(description: string): void {
        this.description = description;
    }

    getTileMap(): TileData[][] {
        return this.tileMap;
    }

    getSize(): number {
        return this.size;
    }

    setTile(x: number, y: number, type: TileType): void {
        this.tileMap[y][x].tileType = type;
    }

    getTile(x: number, y: number): TileData {
        return this.tileMap[y][x];
    }

    setMapObject(x: number, y: number, mapObject: MapObjectType): void {
        this.tileMap[y][x].mapObject = mapObject;
    }

    getMapObject(x: number, y: number): MapObjectType {
        return this.tileMap[y][x].mapObject;
    }

    setGameMode(mode: GameMode): void {
        this.gameMode = mode;
    }

    getGameMode(): GameMode {
        return this.gameMode;
    }

    resetMap(): void {
        // Ajouter un check ici pour renitialiser a l'etat de la db si ce n'est pas une nouvelle map
        this.initializeMap(this.size);
    }
}
