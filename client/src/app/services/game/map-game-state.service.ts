import { Injectable } from '@angular/core';
import { GameService } from '@app/services/game/game.service';
import { MapService } from '@app/services/map/map.service';
import {
    ActionOnTilePayload,
    DebugMovePayload,
    MovePlayerPayload,
    PassFlagPayload,
    UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { GameMode, MapObjectType, TileType } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { DIRECTION_STRING } from '@common/types/game.record';
import { addPositions, isTileDoor, movableTiles, TILE_MOVEMENT_COST } from '@common/utils/map.utils';

const PERCENTAGE = 100;

@Injectable({
    providedIn: 'root',
})
export class MapGameStateService {
    constructor(
        private readonly gameService: GameService,
        private readonly mapService: MapService,
    ) {}

    handlePlayerMovePayload(payload: MovePlayerPayload): void {
        const player = this.gameService.players().find((p) => p.id === payload.playerId);
        if (!player) return;

        const directionVector = DIRECTION_STRING[payload.direction];
        const newPosition = addPositions(player.position, directionVector);

        const tile = this.mapService.getTile(newPosition);
        if (!tile) return;

        const updatedPlayer = this.createMovedPlayer(player, newPosition, tile.tileType);

        if (this.mapService.getGameMode() === GameMode.CTF && tile.mapObject === MapObjectType.Flag) {
            updatedPlayer.hasFlag = true;
            tile.mapObject = MapObjectType.None;
        }

        this.gameService.updatePlayer(player.id, updatedPlayer);
        this.refreshActionTilesForClient(updatedPlayer);
    }

    handleClickDebugPayload(payload: DebugMovePayload): void {
        const player = this.gameService.players().find((p) => p.id === payload.playerId);
        if (!player) return;

        const updatedPlayer: Player = { ...player, position: payload.targetPos };
        this.gameService.updatePlayer(player.id, updatedPlayer);
        this.refreshActionTilesForClient(updatedPlayer);
    }

    updateVisitedTileStats(): void {
        const tiles = this.mapService.getTileMap();
        const terrainTypes = [0, 1, 2];
        let totalTerrainTiles = 0;

        for (const row of tiles) {
            for (const tile of row) {
                if (terrainTypes.includes(tile.tileType)) totalTerrainTiles++;
            }
        }

        this.gameService.getPlayers().forEach((player) => {
            const visited = player.visitedTiles ? Array.from(player.visitedTiles) : [];
            let visitedTerrain = 0;

            for (const key of visited) {
                const [x, y] = key.split(',').map(Number);
                if (terrainTypes.includes(tiles[y][x].tileType)) {
                    visitedTerrain++;
                }
            }

            const percentVisited = totalTerrainTiles > 0 ? Math.round((visitedTerrain / totalTerrainTiles) * PERCENTAGE) : 0;

            this.gameService.updatePlayer(player.id, {
                stats: {
                    ...player.stats,
                    percentageOfTileVisited: percentVisited,
                },
            });
        });
    }

    handleActionOnTile(payload: ActionOnTilePayload): void {
        const player = this.gameService.players().find((p) => p.id === payload.playerId);
        if (!player) return;

        const tile = this.mapService.getTile(payload.position);
        if (!tile) return;

        const shrineMultiplier = payload.isDoubleOrNothing ? (payload.DoubleOrNothingSuccess ? 2 : 0) : 1;

        switch (tile.mapObject) {
            case MapObjectType.HealingShrine: {
                const healingShrine = this.mapService.getShrineAtPosition(payload.position);
                if (healingShrine) {
                    this.gameService.updatePlayer(player.id, { hp: Math.min(player.maxHp, player.hp + 2 * shrineMultiplier) });
                    healingShrine.turnLeftDeactivated = 3;
                    this.mapService.updateShrine(healingShrine);
                }
                break;
            }
            case MapObjectType.CombatShrine: {
                const combatShrine = this.mapService.getShrineAtPosition(payload.position);
                if (combatShrine) {
                    combatShrine.turnLeftDeactivated = 3;
                    this.mapService.updateShrine(combatShrine);
                    this.gameService.updatePlayer(player.id, {
                        attack: player.attack + shrineMultiplier,
                        defense: player.defense + shrineMultiplier,
                        shrineBuffs: {
                            bonusAmount: shrineMultiplier,
                            turnsLeft: 2,
                        },
                    });
                }
                break;
            }
            case MapObjectType.None:
                if (isTileDoor(tile)) {
                    this.mapService.setTile(payload.position, tile.tileType === TileType.CloseDoor ? TileType.OpenDoor : TileType.CloseDoor);
                    this.gameService.updatePlayer(player.id, { actionsLeft: player.actionsLeft - 1 });
                }
                break;
        }
    }

    handlePassFlag(payload: PassFlagPayload): void {
        const initiator = this.gameService.players().find((p) => p.id === payload.initiatorId);
        const target = this.gameService.players().find((p) => p.id === payload.targetId);
        if (!initiator || !target) return;

        this.gameService.updatePlayer(initiator.id, { hasFlag: false });
        this.gameService.updatePlayer(target.id, { hasFlag: true });
    }

    handleUpdateFlag(payload: UpdateFlagPayload): void {
        const player = this.gameService.players().find((p) => p.id === payload.playerId);
        if (!player) return;

        this.gameService.updatePlayer(player.id, { hasFlag: payload.flagStatus });
        this.mapService.setMapObject(payload.position, payload.flagStatus ? MapObjectType.None : MapObjectType.Flag);
    }

    private createMovedPlayer(player: Player, newPosition: { x: number; y: number }, tileType: TileType): Player {
        const visitedTiles: string[] = Array.isArray(player.visitedTiles) ? [...player.visitedTiles] : [];
        const newTile = `${newPosition.x},${newPosition.y}`;
        if (!visitedTiles.includes(newTile)) {
            visitedTiles.push(newTile);
        }

        return {
            ...player,
            position: newPosition,
            movementPoints: player.movementPoints - TILE_MOVEMENT_COST[tileType],
            visitedTiles,
            hasFlag: player.hasFlag,
        };
    }

    private refreshActionTilesForClient(updatedPlayer: Player): void {
        if (this.gameService.clientPlayer()?.id !== updatedPlayer.id) return;

        if (!this.gameService.canPlayerStillDoAction()) {
            return;
        }

        this.gameService.actionTile.set(movableTiles(this.mapService.getTileMap(), updatedPlayer, this.gameService.getPlayers()));
    }
}
