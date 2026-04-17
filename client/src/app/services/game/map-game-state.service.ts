import { Injectable } from '@angular/core';
import { GameService } from '@app/services/game/game.service';
import { MapService } from '@app/services/map/map.service';
import { SocketClientService } from '@app/services/socket/socket-client.service';
import { GameMode, MapObjectType, TileType } from '@common/enums/map.enums';
import {
    ActionOnTilePayload,
    DebugMovePayload,
    MovePlayerPayload,
} from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { PERCENTAGE, SHRINE_BUFF_DURATION, SHRINE_TURN_LEFT } from '@common/types/game.constant';
import { DIRECTION_STRING } from '@common/types/game.record';
import { GatewayEvents } from '@common/types/gateway.events';
import { addPositions, isTileDoor, movableTiles, TILE_MOVEMENT_COST } from '@common/utils/map.utils';

@Injectable({
    providedIn: 'root',
})
export class MapGameStateService {
    constructor(
        private readonly gameService: GameService,
        private readonly mapService: MapService,
        private readonly socketService: SocketClientService,
    ) {}

    handlePlayerMovePayload(payload: MovePlayerPayload): void {
        const player = this.gameService.players().find((findPlayer) => findPlayer.id === payload.playerId);
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
        const player = this.gameService.players().find((findPlayer) => findPlayer.id === payload.playerId);
        if (!player) return;

        const updatedPlayer: Player = {
            ...player,
            position: payload.targetPos,
            visitedTiles: this.getUpdatedVisitedTiles(player, payload.targetPos),
        };
        this.gameService.updatePlayer(player.id, updatedPlayer);
        this.refreshActionTilesForClient(updatedPlayer);
    }

    updateVisitedTileStats(): void {
        const tiles = this.mapService.getTileMap();
        let totalTiles = 0;

        for (const row of tiles) {
            for (const tile of row) {
                if (this.gameService.isSpecialTile(tile)) {
                    totalTiles++;
                }
            }
        }

        this.gameService.getPlayers().forEach((player) => {
            const visited: string[] = player.visitedTiles ? [...player.visitedTiles] : [];
            let visitedTiles = 0;

            for (const key of visited) {
                const [x, y] = key.split(',').map(Number);
                const tile = tiles[y][x];
                if (tile && this.gameService.isSpecialTile(tile)) {
                    visitedTiles++;
                }
            }

            const percentVisited = totalTiles > 0 ? Math.round((visitedTiles / totalTiles) * PERCENTAGE) : 0;

            this.gameService.updatePlayer(player.id, {
                stats: {
                    ...player.stats,
                    percentageOfTileVisited: percentVisited,
                },
            });
        });
    }

    handleActionOnTile(payload: ActionOnTilePayload): void {
        const player = this.gameService.players().find((findPlayer) => findPlayer.id === payload.playerId);
        if (!player) return;

        const tile = this.mapService.getTile(payload.position);
        if (!tile) return;

        const shrineMultiplier = payload.isDoubleOrNothing ? (payload.DoubleOrNothingSuccess ? 2 : 0) : 1;
        let actionApplied = false;

        switch (tile.mapObject) {
            case MapObjectType.HealingShrine: {
                const healingShrine = this.mapService.getShrineAtPosition(payload.position);
                if (healingShrine) {
                    this.gameService.updatePlayer(player.id, { hp: Math.min(player.maxHp, player.hp + 2 * shrineMultiplier) });
                    healingShrine.turnLeftDeactivated = SHRINE_TURN_LEFT;
                    this.mapService.updateShrine(healingShrine, payload);
                    actionApplied = true;
                }
                break;
            }
            case MapObjectType.CombatShrine: {
                const combatShrine = this.mapService.getShrineAtPosition(payload.position);
                if (combatShrine) {
                    combatShrine.turnLeftDeactivated = SHRINE_TURN_LEFT;
                    this.mapService.updateShrine(combatShrine, payload);
                    this.gameService.updatePlayer(player.id, {
                        attack: player.attack + shrineMultiplier,
                        defense: player.defense + shrineMultiplier,
                        shrineBuffs: {
                            bonusAmount: shrineMultiplier,
                            turnsLeft: SHRINE_BUFF_DURATION,
                        },
                    });
                    actionApplied = true;
                }
                break;
            }
            case MapObjectType.None:
                if (isTileDoor(tile)) {
                    this.mapService.setTile(payload.position, tile.tileType === TileType.CloseDoor ? TileType.OpenDoor : TileType.CloseDoor);
                    this.mapService.addManipulatedDoor(payload.position);
                    actionApplied = true;
                }
                break;
        }

        if (actionApplied && player.actionsLeft > 0) {
            this.gameService.updatePlayer(player.id, { actionsLeft: player.actionsLeft - 1 });
        }

        if (this.gameService.canPlayerStillDoAction()) {
            this.gameService.actionTile.set(movableTiles(this.mapService.getTileMap(), player, this.gameService.getPlayers()));
        } else {
            this.gameService.actionTile.set([]);
            this.socketService.send(GatewayEvents.EndTurnEarly);
        }
    }

    private createMovedPlayer(player: Player, newPosition: { x: number; y: number }, tileType: TileType): Player {
        return {
            ...player,
            position: newPosition,
            movementPoints: player.movementPoints - TILE_MOVEMENT_COST[tileType],
            visitedTiles: this.getUpdatedVisitedTiles(player, newPosition),
            hasFlag: player.hasFlag,
        };
    }

    private getUpdatedVisitedTiles(player: Player, position: { x: number; y: number }): string[] {
        const visitedTiles: string[] = Array.isArray(player.visitedTiles) ? [...player.visitedTiles] : [];
        const tileKey = `${position.x},${position.y}`;

        if (!visitedTiles.includes(tileKey)) {
            visitedTiles.push(tileKey);
        }

        return visitedTiles;
    }

    private refreshActionTilesForClient(updatedPlayer: Player): void {
        if (this.gameService.clientPlayer()?.id !== updatedPlayer.id) return;

        if (!this.gameService.canPlayerStillDoAction()) {
            return;
        }

        this.gameService.actionTile.set(movableTiles(this.mapService.getTileMap(), updatedPlayer, this.gameService.getPlayers()));
    }
}
