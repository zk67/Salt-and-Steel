import { Injectable } from '@angular/core';
import { TileType, MapObjectType, TileData } from '@common/types/map.interface';
import { GameService } from './game.service';
import { isStringValid, MAX_DESCRIPTION_LENGTH, MIN_NAME_LENGTH } from '@common/classes/utils';
import { ToolService } from '@app/services/tool/tool.service';
import { Game } from '@common/classes/game';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class SaveService {

    constructor(private gameService: GameService, private toolService: ToolService) {}

    async validateBeforeSave(game: Game): Promise<string[]> {
        const errors: string[] = [];

        if(!isStringValid(game.map.name)){
            errors.push('Le nom de la carte est invalide.');
        }

        if(!isStringValid(game.map.description, MIN_NAME_LENGTH, MAX_DESCRIPTION_LENGTH)){
            errors.push('La description de la carte est invalide.');
        }

        if (!this.hasEnoughBasicTiles(game.map.tiles, game.map.size)) {
            errors.push('Le nombre de tuiles de terrain doit couvrir plus de la moitié de la zone de jeu.');
        }

        if (!this.isMapAccessible(game.map.tiles, game.map.size)) {
            errors.push('Certaines tuiles sur le jeu sont inaccessibles.');
        }

        if (!this.hasCorrectSpawnPoints()) {
            errors.push('Le nombre de points de départ ne correspond pas aux exigences.');
        }

        if (await this.validateNameUniqueness(game)) {
            errors.push('Un jeu avec ce nom existe déjà.');
        }

        return errors;
    }

    private async validateNameUniqueness(game: Game): Promise<boolean> {
        const games = await firstValueFrom(this.gameService.getAllGames());
        return games.some(g => g.name === game.map.name && g._id !== game._id);
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

    private hasCorrectSpawnPoints(): boolean {
        return this.toolService.getNumberObject(MapObjectType.SpawnPoint) === 0;
    }
}
