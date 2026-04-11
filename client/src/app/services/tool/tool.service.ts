import { Injectable } from '@angular/core';
import { MapService } from '@app/services/map/map.service';
import { getShrineImageUrl } from '@app/utils/tile';
import { MapObjectType, MapSize, Shrine, TileType, GameMode } from '@common/interfaces/map.interface';
import { isShrine, Position } from '@common/utils/map.utils';

const OBJECT_QUANTITY_SMALL = 2;
const OBJECT_QUANTITY_MEDIUM = 4;
const OBJECT_QUANTITY_LARGE = 6;


@Injectable({
    providedIn: 'root',
})
export class ToolService {
    private tileType: TileType = TileType.Basic;
    private mapObjectType: MapObjectType = MapObjectType.None;
    private toolType: ToolType = ToolType.None;
    private numberSpawnPoint = 0;
    private numberFlag = 0;
    private numberHealingShrine = 0;
    private numberCombatShrine = 0;

    constructor(private mapService: MapService) {}

    setTileType(type: TileType): void {
        this.toolType = ToolType.Tile;
        this.tileType = type;
    }

    setMapObjectType(type: MapObjectType): void {
        this.toolType = ToolType.Object;
        this.mapObjectType = type;
    }

    getTileType(): TileType {
        return this.tileType;
    }

    getMapObjectType(): MapObjectType {
        return this.mapObjectType;
    }

    getToolType(): ToolType {
        return this.toolType;
    }

    useTool(button: number, shiftKey: boolean, position: Position): void {
        if (button === 0) {
            this.place(position);
        } else if (button === 2) {
            this.delete(position, shiftKey);
        }
    }

    place(position: Position): void {
        if (this.toolType === ToolType.None) return;
        const tile = this.mapService.getTile(position);
        if (!tile) return;

        if (this.toolType === ToolType.Tile) {
            if (this.tileType === TileType.Wall) {
                this.setNumberObject(tile.mapObject, false);
                this.mapService.setMapObject(position, MapObjectType.None);
            }

            if (this.tileType === TileType.CloseDoor) {
                if (!this.isDoorPlacementValid(position))
                    return;

                if (tile.tileType === TileType.CloseDoor) {
                    this.mapService.setTile(position, TileType.OpenDoor);
                    return;
                } else if (tile.tileType === TileType.OpenDoor) {
                    this.mapService.setTile(position, TileType.CloseDoor);
                    return;
                }
            }

            this.mapService.setTile(position, this.tileType);
        } else if (this.mapObjectType !== MapObjectType.None) {
            if (tile.tileType !== TileType.Wall && this.getNumberObject(this.mapObjectType) > 0) {
                if(isShrine(this.mapObjectType)){
                    this.placeShrine(position);
                    return;
                }

                if(isShrine(tile.mapObject)){
                    this.deleteShrine(position);
                } else if (tile.mapObject !== MapObjectType.None){
                    this.setNumberObject(tile.mapObject, false);
                }

                this.mapService.setMapObject(position, this.mapObjectType);
                this.setNumberObject(this.mapObjectType);
            }
        }
    }

    delete(position: Position, shiftKeyPressed: boolean = false): void {
        if (shiftKeyPressed) {
            const mapObject = this.mapService.getMapObject(position);
            if(isShrine(mapObject)){
                this.deleteShrine(position);
                return;
            }

            this.setNumberObject(mapObject, false);
            this.mapService.setMapObject(position, MapObjectType.None);
        } else {
            this.mapService.setTile(position, TileType.Basic);
        }
    }

    defaultNumbers(): void {
        if (this.mapService.getGameMode() === GameMode.CTF) {
            this.numberFlag = 1; // Pareil pour tous les tailles de carte
        }

        switch (this.mapService.getSize()) {
            case MapSize.Small:
                this.numberSpawnPoint = OBJECT_QUANTITY_SMALL;
                this.numberHealingShrine = 1;
                this.numberCombatShrine = 1;
                break;
            case MapSize.Medium:
                this.numberSpawnPoint = OBJECT_QUANTITY_MEDIUM;
                this.numberHealingShrine = OBJECT_QUANTITY_SMALL;
                this.numberCombatShrine = OBJECT_QUANTITY_SMALL;
                break;
            case MapSize.Large:
                this.numberSpawnPoint = OBJECT_QUANTITY_LARGE;
                this.numberHealingShrine = OBJECT_QUANTITY_MEDIUM;
                this.numberCombatShrine = OBJECT_QUANTITY_MEDIUM;
                break;
        }

        const gameData = this.mapService.getGameData();

        if (gameData) {
            gameData.tiles.flat().filter(t => t.mapObject !== MapObjectType.None && !isShrine(t.mapObject)).forEach((tile) => {
                this.setNumberObject(tile.mapObject);
            });

            gameData.shrine.forEach((shrine) => {
                this.setNumberObject(shrine.objectType);
            });
        }
    }

    getNumberObject(type: MapObjectType): number {
        switch (type) {
            case MapObjectType.SpawnPoint: return this.numberSpawnPoint;
            case MapObjectType.Flag: return this.numberFlag;
            case MapObjectType.HealingShrine: return this.numberHealingShrine;
            case MapObjectType.CombatShrine: return this.numberCombatShrine;
        }
        return 0;
    }

    setNumberObject(type: MapObjectType, place: boolean = true): void {
        switch (type) {
            case MapObjectType.SpawnPoint: this.numberSpawnPoint += place ? -1 : 1; break;
            case MapObjectType.Flag: this.numberFlag += place ? -1 : 1; break;
            case MapObjectType.HealingShrine: this.numberHealingShrine += place ? -1 : 1; break;
            case MapObjectType.CombatShrine: this.numberCombatShrine += place ? -1 : 1; break;
        }
    }

    private isDoorPlacementValid(position: Position): boolean {
        const isOnBorder = position.x === 0 || position.y === 0 ||
            position.x === this.mapService.getSize() - 1 || position.y === this.mapService.getSize() - 1;
        return !isOnBorder;
    }

    private placeShrine(position: Position): void {
        const positions = this.getShrinePositions(position);
        if (!this.isShrinePlacementValid(positions)) {
            return;
        }

        const shrine: Shrine = {
            objectType: this.mapObjectType,
            position: positions,
            imageUrl: [] as string[],
            turnLeftDeactivated: 0,
        };

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            this.delete(pos, true);
            this.mapService.setMapObject(pos, this.mapObjectType);
            shrine.imageUrl.push(getShrineImageUrl(this.mapObjectType, i));
        }

        this.mapService.addShrine(shrine);
        this.setNumberObject(this.mapObjectType);
    }

    private deleteShrine(position: Position): void {
        const shrine = this.mapService.removeShrineByPosition(position);
        if (!shrine) return;

        shrine.position.forEach(pos => {
            this.mapService.setMapObject(pos, MapObjectType.None);
        });

        this.setNumberObject(shrine.objectType, false);
    }

    private getShrinePositions(position: Position): Position[] {
        const right = { x: position.x + 1, y: position.y };
        const down = { x: position.x, y: position.y + 1 };
        const downRight = { x: position.x + 1, y: position.y + 1 };

        return [position, right, down, downRight];
    }

    private isShrinePlacementValid(positions: Position[]): boolean {
        const size = this.mapService.getSize();
        return positions.every((pos) => {
            const isInBounds = pos.x >= 0 && pos.y >= 0 && pos.x < size && pos.y < size;
            if (!isInBounds) {
                return false;
            }

            return this.mapService.getTile(pos)?.tileType !== TileType.Wall;
        });
    }
}

export enum ToolType {
    None,
    Tile,
    Object,
}
