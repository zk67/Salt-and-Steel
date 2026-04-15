import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ToolService } from '@app/services/tool/tool.service';
import { isStringValid, MAX_DESCRIPTION_LENGTH, MIN_NAME_LENGTH } from '@app/utils/validation';
import { Game } from '@common/interfaces/game.interface';
import { MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { firstValueFrom, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { createBooleanGrid, isValidTile, getNeighborPositions, Position, isTileDoor, isShrine } from '@common/utils/map.utils';

@Injectable({
    providedIn: 'root',
})
export class SaveService {
    private readonly baseUrl: string = environment.serverUrl;
    constructor(private toolService: ToolService, private readonly http: HttpClient) {}

    async validateBeforeSave(game: Game): Promise<string[]> {
        const errors: string[] = [];

        if (!isStringValid(game.name)) {
            errors.push('Le nom de la carte est invalide.');
        }

        if (!isStringValid(game.description, MIN_NAME_LENGTH, MAX_DESCRIPTION_LENGTH)) {
            errors.push('La description de la carte est invalide.');
        }

        if (!this.hasEnoughBasicTiles(game.tiles, game.size)) {
            errors.push('Le nombre de tuiles de terrain doit couvrir plus de la moitié de la zone de jeu.');
        }

        if (!this.isMapAccessible(game)) {
            errors.push('Certaines tuiles sur le jeu sont inaccessibles.');
        }

        if (!this.hasCorrectSpawnPoints()) {
            errors.push('Le nombre de points de départ ne correspond pas aux exigences.');
        }

        if (await this.validateNameUniqueness(game)) {
            errors.push('Un jeu avec ce nom existe déjà.');
        }

        if (!this.areDoorBetweenWalls(game.tiles)) {
            errors.push('Les portes doivent avoir des murs entre eux.');
        }

        if (!this.hasCorrectFlags()) {
            errors.push('Le nombre de drapeaux ne correspond pas aux exigences.');
        }

        return errors;
    }

    private async validateNameUniqueness(game: Game): Promise<boolean> {
        const games = await firstValueFrom(this.getAllGames());
        return games.some(g => g.name === game.name && g._id !== game._id);
    }

    private hasEnoughBasicTiles(tiles: TileData[][], size: number): boolean {
        const numberTiles = tiles.flat().filter(t => t.tileType !== TileType.Wall).length;
        return numberTiles >= (size * size) / 2;
    }

    private isMapAccessible(game: Game): boolean {
        const { tiles } = game;
        const visited = createBooleanGrid(tiles);
        const startPosition = this.findFirstAccessibleTile(tiles);

        if (!startPosition) return false;

        this.floodFillAccessibleTiles(tiles, visited, startPosition);

        if (this.hasUnvisitedAccessibleTile(tiles, visited)) return false;

        return this.areShrinesInteractable(game, visited);
    }

    private findFirstAccessibleTile(tiles: TileData[][]): Position | null {
        for (let y = 0; y < tiles.length; y++) {
            const x = tiles[y].findIndex(tile => this.isTileAccessible(tile));
            if (x !== -1) return { x, y };
        }

        return null;
    }

    private floodFillAccessibleTiles(
        tiles: TileData[][],
        visited: boolean[][],
        startPosition: Position,
    ): void {
        const queue: Position[] = [startPosition];
        visited[startPosition.y][startPosition.x] = true;

        while (queue.length > 0) {
            const currentPosition = queue.shift();
            if (!currentPosition) continue;

            for (const newPosition of getNeighborPositions(currentPosition)) {
                if (!isValidTile(tiles, newPosition)) continue;
                if (visited[newPosition.y][newPosition.x]) continue;
                if (!this.isTileAccessible(tiles[newPosition.y][newPosition.x])) continue;

                visited[newPosition.y][newPosition.x] = true;
                queue.push(newPosition);
            }
        }
    }

    private isTileAccessible(tile: TileData): boolean {
        return tile.tileType !== TileType.Wall && !isShrine(tile.mapObject);
    }

    private hasUnvisitedAccessibleTile(tiles: TileData[][], visited: boolean[][]): boolean {
        return tiles.some((row, y) => row.some((tile, x) => this.isTileAccessible(tile) && !visited[y][x]));
    }

    private areShrinesInteractable(game: Game, visited: boolean[][]): boolean {
        const shrines = game.shrine;
        for (const shrine of shrines) {
            let isShrineAccessible = false;
            for (const position of shrine.position) {
                if (isValidTile(game.tiles, position) && visited[position.y][position.x]) {
                    isShrineAccessible = true;
                    break;
                }
            }

            if (!isShrineAccessible) {
                return false;
            }
        }

        return true;
    }

    private hasCorrectSpawnPoints(): boolean {
        return this.toolService.getNumberObject(MapObjectType.SpawnPoint) === 0;
    }

    private hasCorrectFlags(): boolean {
        return this.toolService.getNumberObject(MapObjectType.Flag) === 0;
    }

    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/games`).pipe(catchError(this.handleError<Game[]>('getAllGames')));
    }

    getAllVisibleGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/games/visible`).pipe(catchError(this.handleError<Game[]>('getVisibleGames')));
    }

    addGame(game: Game): Observable<Game> {
        return this.http.post<Game>(`${this.baseUrl}/games`, game).pipe(catchError(this.handleError<Game>('addGame')));
    }

    replaceGame(_id: string, game: Game): Observable<Game> {
        return this.http.put<Game>(`${this.baseUrl}/games/${_id}`, game).pipe(catchError(this.handleError<Game>('replaceGame')));
    }

    deleteGame(_id: string): Observable<Game> {
        return this.http.delete<Game>(`${this.baseUrl}/games/${_id}`).pipe(catchError(this.handleError<Game>('deleteGame')));
    }

    getGame(_id: string): Observable<Game> {
        return this.http.get<Game>(`${this.baseUrl}/games/${_id}`).pipe(catchError(this.handleError<Game>('getGame')));
    }

    updateGameVisibility(_id: string, visibility: boolean): Observable<Game> {
        const game: Partial<Game> = { visible: visibility };
        return this.http.patch<Game>(`${this.baseUrl}/games/${_id}`, game).pipe(catchError(this.handleError<Game>('patchGame')));
    }

    private handleError<T>(request: string): (error: Error) => Observable<T> {
        return (error: Error) => {
            throw new Error(`Erreur lors de la requête ${request}: ${error.message}`);
        };
    }

    private areDoorBetweenWalls(tiles: TileData[][]): boolean {
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                const tile = tiles[y][x];

                if (!isTileDoor(tile)) continue;

                const up = { x, y: y - 1 };
                const down = { x, y: y + 1 };
                const left = { x: x - 1, y };
                const right = { x: x + 1, y };

                const isWall = (position: Position): boolean => {
                    if (!isValidTile(tiles, position)) return false;
                    return tiles[position.y][position.x].tileType === TileType.Wall;
                };

                const isTerrain = (position: Position): boolean => {
                    if (!isValidTile(tiles, position)) return false;

                    const type = tiles[position.y][position.x].tileType;
                    return type !== TileType.Wall && !isTileDoor(tiles[position.y][position.x]);
                };

                const validVerticalDoor = isWall(up) && isWall(down) && isTerrain(left) && isTerrain(right);
                const validHorizontalDoor = isWall(left) && isWall(right) && isTerrain(up) && isTerrain(down);

                if (!validVerticalDoor && !validHorizontalDoor) {
                    return false;
                }
            }
        }

        return true;
    }
}
