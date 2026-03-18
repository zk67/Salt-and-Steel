import { MapObjectType, TileData, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';

export type Position = { x: number; y: number };
type MovementState = Position & { movementPoints: number };

export const DIRECTION: readonly Position[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
];

export function equalPositions(pos1: Position, pos2: Position): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y;
}

export function arePositionAdjacent(pos1: Position, pos2: Position): boolean {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

export function addPositions(pos1: Position, pos2: Position): Position {
    return { x: pos1.x + pos2.x, y: pos1.y + pos2.y };
}

export const TILE_MOVEMENT_COST: Record<TileType, number> = {
    [TileType.Basic]: 1,
    [TileType.Water]: 2,
    [TileType.Ice]: 0,
    [TileType.Wall]: Infinity,
    [TileType.Door]: 1,
};

export function getPlayerAt(players: Player[] | undefined, position: Position): Player | null {
    if (!players) return null;
    return players.find(p => equalPositions(p.position, position)) || null;
}

export function createBooleanGrid(tiles: TileData[][]): boolean[][] {
    return tiles.map(row => row.map(() => false));
}

export function isValidTile(tiles: TileData[][], position: Position): boolean {
    return !(position.x < 0 || position.y < 0 || position.y >= tiles.length || position.x >= tiles[position.y].length);
}

function canMoveToTile(tiles: TileData[][], players: Player[], state: MovementState, target: Position): number | null {
    if (!isValidTile(tiles, target)) return null;
    if (getPlayerAt(players, target)) return null;

    const tile = tiles[target.y][target.x];
    const movementCost = TILE_MOVEMENT_COST[tile.tileType];
    const remainingMovementPoints = state.movementPoints - movementCost;

    return remainingMovementPoints < 0 ? null : remainingMovementPoints;
}

function getVisitedKey(position: Position): string {
    return `${position.x},${position.y}`;
}

function shouldVisitTile(visited: Map<string, number>, position: Position, remainingMovementPoints: number): boolean {
    const previousMovementPoints = visited.get(getVisitedKey(position));
    return previousMovementPoints === undefined || remainingMovementPoints > previousMovementPoints;
}

export function movableTiles(tiles: TileData[][], player: Player, players: Player[]): boolean[][] {
    const result = createBooleanGrid(tiles);

    const visited = new Map<string, number>();
    const queue: MovementState[] = [];
    const initialState: MovementState = { ...player.position, movementPoints: player.movementPoints };

    queue.push(initialState);
    visited.set(getVisitedKey(initialState), initialState.movementPoints);
    result[initialState.y][initialState.x] = true;

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        for (const newPosition of getNeighborPositions(current)) {
            const remainingMovementPoints = canMoveToTile(tiles, players, current, newPosition);
            if (remainingMovementPoints === null) continue;

            if (!shouldVisitTile(visited, newPosition, remainingMovementPoints)) continue;

            const target: MovementState = { ...newPosition, movementPoints: remainingMovementPoints };

            visited.set(getVisitedKey(target), target.movementPoints);
            result[target.y][target.x] = true;
            queue.push(target);
        }
    }

    return result;
}

export function getActionableTiles(tiles: TileData[][], player: Player, players: Player[]): boolean[][] {
    const result = createBooleanGrid(tiles);

    DIRECTION.forEach(direction => {
        const newPosition = addPositions(player.position, direction);
        const tile = isValidTile(tiles, newPosition) ? tiles[newPosition.y][newPosition.x] : null;

        if (!tile) {
            return;
        }

        if (getPlayerAt(players, newPosition) || (tile.mapObject !== MapObjectType.None) && (tile.mapObject !== MapObjectType.SpawnPoint)) {
            result[newPosition.y][newPosition.x] = true;
        }
    });

    return result;
}

export function getNeighborPositions(position: Position): Position[] {
    return DIRECTION.map(direction => ({ x: position.x + direction.x, y: position.y + direction.y }));
}

export function findNearestFreeSpawn(
    tiles: TileData[][],
    spawn: Position,
    players: Player[],
    excludePlayerId: string,
): Position {
    const otherPlayers = players.filter(p => p.id !== excludePlayerId);

    if (!getPlayerAt(otherPlayers, spawn)) {
        return spawn;
    }

    const visited = new Set<string>();
    const queue: Position[] = [spawn];
    visited.add(getVisitedKey(spawn));

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        for (const possiblePosition of getNeighborPositions(current)) {
            if (!isValidTile(tiles, possiblePosition)) continue;

            const key = getVisitedKey(possiblePosition);
            if (visited.has(key)) continue;
            visited.add(key);

            if (TILE_MOVEMENT_COST[tiles[possiblePosition.y][possiblePosition.x].tileType] === Infinity) continue;

            if (!getPlayerAt(otherPlayers, possiblePosition)) {
                return possiblePosition;
            }

            queue.push(possiblePosition);
        }
    }

    return spawn;
}
