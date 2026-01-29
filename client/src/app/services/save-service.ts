import { Injectable } from '@angular/core';
import { MapService } from '@app/services/map/map.service';
import { TileType, MapObjectType, TileData } from '@common/types/map.interface';
import { GameService } from './game.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';


const SMALL_MAP_SIZE = 10;
const MEDIUM_MAP_SIZE = 15;
const LARGE_MAP_SIZE = 20;
const SMALL_MAP_SPAWNS = 2;
const MEDIUM_MAP_SPAWNS = 4;
const LARGE_MAP_SPAWNS = 6;

@Injectable({
    providedIn: 'root',
})
export class SaveService {

    constructor(private mapService: MapService, private gameService: GameService) {}


    async validateBeforeSave(): Promise<string[]> {
        const tileMap = this.mapService.getTileMap();
        const size = this.mapService.getSize();
        const name = this.mapService.getName();
        const errors: string[] = [];

        if (!this.hasEnoughBasicTiles(tileMap, size)) {
            errors.push('Le nombre de tuiles de terrain doit couvrir plus de la moitié de la zone de jeu.');
        }

        if (!this.isMapAccessible(tileMap, size)) {
            errors.push('Certaines tuiles sur le jeu sont inaccessibles.');
        }

        if (!this.hasCorrectSpawnPoints(tileMap, size)) {
            errors.push('Le nombre de points de départ ne correspond pas aux exigences.');
        }

        const nameError = await this.validateNameUniqueness(name).toPromise();
        if (nameError) {
            errors.push(nameError);
        }

        return errors;
    }


    private validateNameUniqueness(name: string): Observable<string | null> {
        return this.gameService.getAllGames().pipe(
            map((games) => {
                const exists = games.some(game => game.name === name);
                return exists ? 'Un jeu avec ce nom existe déjà.' : null;
            }),
        );
    }

    private hasEnoughBasicTiles(tiles: TileData[][], size: number): boolean {
        const numberTiles = tiles.flat().filter(t => t.tileType === TileType.Basic).length;
        return numberTiles >= (size * size) / 2;
    }

    private isMapAccessible(tiles: TileData[][], size: number): boolean {
        const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

        let startX = -1;
        let startY = -1;

        tiles.some((row, y) => {
            const x = row.findIndex(tile => tile.tileType !== TileType.Wall);
            if (x !== -1) {
                startX = x;
                startY = y;
                return true;
            }
            return false;
        });

        if (startX === -1) return false;

        const queue: [number, number][] = [[startX, startY]];
        visited[startY][startX] = true;

        const directions = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) break;

            const [x, y] = current;

            for (const [dx, dy] of directions) {
                const newX = x + dx;
                const newY = y + dy;

                if (
                    newX >= 0 &&
                    newX < size &&
                    newY >= 0 &&
                    newY < size &&
                    !visited[newY][newX] &&
                    tiles[newY][newX].tileType !== TileType.Wall
                ) {
                    visited[newY][newX] = true;
                    queue.push([newX, newY]);
                }
            }
        }

        return !tiles.some((row, y) =>
            row.some((tile, x) =>
                tile.tileType !== TileType.Wall && !visited[y][x],
            ),
        );
    }

    private hasCorrectSpawnPoints(tiles: TileData[][], size: number): boolean {
        let requiredSpawns = 0;

        switch (size) {
            case SMALL_MAP_SIZE:
                requiredSpawns = SMALL_MAP_SPAWNS;
                break;
            case MEDIUM_MAP_SIZE:
                requiredSpawns = MEDIUM_MAP_SPAWNS;
                break;
            case LARGE_MAP_SIZE:
                requiredSpawns = LARGE_MAP_SPAWNS;
                break;
        }

        const numberSpawns = tiles.flat().filter(t => t.mapObject === MapObjectType.SpawnPoint).length;
        return numberSpawns === requiredSpawns;
    }
}
