import { PlayableGame } from '@app/interface/game.interface';
import { ActionOnTilePayload } from '@common/interfaces/game.interface';
import { MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import {
    addPositions, isShrine, isValidTile,
    Position, TILE_MOVEMENT_COST,
} from '@common/utils/map.utils';

export const VP_DIRECTIONS: Record<string, Position> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

export class VirtualPlayerMovementService {

    bfsPath(start: Position, goal: Position, game: PlayableGame, vp: Player): Position[] | null {
        const tiles = game._game.tiles;

        const key = (p: Position) => `${p.x},${p.y}`;

        const visited = new Set<string>();
        const queue: { pos: Position; path: Position[] }[] = [];

        visited.add(key(start));
        queue.push({ pos: start, path: [start] });

        const directions = Object.values(VP_DIRECTIONS);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;

            const { pos, path } = current;

            if (pos.x === goal.x && pos.y === goal.y) {
                return path;
            }

            for (const dir of directions) {
                const next: Position = addPositions(pos, dir);
                const k = key(next);

                if (visited.has(k)) continue;
                if (!isValidTile(tiles, next)) continue;

                const tile = tiles[next.y][next.x];

                if (tile.tileType === TileType.Wall) continue;
                if (tile.tileType === TileType.CloseDoor && vp.actionsLeft === 0) continue;
                if(isShrine(tile.mapObject)) continue;

                const isGoal = next.x === goal.x && next.y === goal.y;

                const occupied = game.players.some(
                    p => p.id !== vp.id &&
                        p.position.x === next.x &&
                        p.position.y === next.y,
                );

                if (occupied && !isGoal) continue;

                visited.add(k);
                queue.push({
                    pos: next,
                    path: [...path, next],
                });
            }
        }

        return null;
    }

    moveToward(vp: Player, target: Position, game: PlayableGame): boolean {
        if (vp.movementPoints <= 0) return false;

        const path = this.bfsPath(vp.position, target, game, vp);
        if (!path || path.length < 2) return false;

        const next = path[1];
        const tile = game._game.tiles[next.y][next.x];
        const cost = TILE_MOVEMENT_COST[tile.tileType] ?? 1;

        if (vp.movementPoints < cost) return false;

        const occupied = game.players.some(
            p => p.id !== vp.id && p.position.x === next.x && p.position.y === next.y,
        );
        if (occupied) return false;

        vp.movementPoints -= cost;
        vp.position = next;
        return true;
    }

    findNearestEnemy(vp: Player, enemies: Player[], game: PlayableGame): Position | null {
        let best: Position | null = null;
        let bestDist = Infinity;

        for (const e of enemies) {
            for (const dir of Object.values(VP_DIRECTIONS)) {
                const adjacent = addPositions(e.position, dir);

                if (!isValidTile(game._game.tiles, adjacent)) continue;

                const path = this.bfsPath(vp.position, adjacent, game, vp);
                if (path && path.length < bestDist) {
                    bestDist = path.length;
                    best = adjacent;
                }
            }
        }
        return best;
    }

    findFurthestSafePosition(vp: Player, enemies: Player[], game: PlayableGame): Position | null {
        const tiles = game._game.tiles;
        let best: Position | null = null;
        let bestDist = -1;

        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                const tile = tiles[y][x];
                if (tile.tileType === TileType.Wall || tile.tileType === TileType.CloseDoor) continue;

                const minEnemyDist = enemies.length > 0
                    ? Math.min(...enemies.map(e => Math.abs(e.position.x - x) + Math.abs(e.position.y - y)))
                    : Infinity;

                if (minEnemyDist > bestDist) {
                    bestDist = minEnemyDist;
                    best = { x, y };
                }
            }
        }

        return best;
    }


    findAdjacentTileAction(vp: Player, game: PlayableGame): ActionOnTilePayload | null {
        const tiles = game._game.tiles;

        for (const dir of Object.values(VP_DIRECTIONS)) {
            const pos = addPositions(vp.position, dir);
            if (!isValidTile(tiles, pos)) continue;

            const tile = tiles[pos.y][pos.x];
            const isInteractable =
                tile.tileType === TileType.CloseDoor || this.isShrineInteractable(pos, game);

            if (isInteractable) {
                return { playerId: vp.id, position: pos, isDoubleOrNothing: false };
            }
        }

        return null;
    }

    findFlagPosition(game: PlayableGame): Position | null {
        const tiles = game._game.tiles;
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                if (tiles[y][x].mapObject === MapObjectType.Flag) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    isShrineInteractable(position: Position, game: PlayableGame): boolean {
        const tile = game._game.tiles[position.y][position.x];
        if(!isShrine(tile.mapObject)) return false;

        const shrine = game._game.shrine?.find(s => s.position.some(p => p.x === position.x && p.y === position.y));
        if(shrine.turnLeftDeactivated > 0) return false;

        return true;
    }
}