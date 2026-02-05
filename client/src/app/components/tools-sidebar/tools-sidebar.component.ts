import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GameService } from '@app/services/game.service';
import { MapService } from '@app/services/map/map.service';
import { SaveService } from '@app/services/save.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { Game } from '@common/classes/game';
import { MapObjectType, MapSize, TileType } from '@common/types/map.interface';
import { MIN_PLAYERS, MAX_PLAYERS_SMALL, MAX_PLAYERS_MEDIUM, MAX_PLAYERS_LARGE } from '@common/const/gameSizeConst';

@Component({
    selector: 'app-tools-sidebar',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './tools-sidebar.component.html',
    styleUrls: ['./tools-sidebar.component.scss'],
})
export class ToolsSidebarComponent {
    placementOptionsOpen = false;
    textOptionsOpen = false;

    // Pour le html
    tileType = TileType;
    mapObjectType = MapObjectType;
    toolType = ToolType;

    constructor(
        public toolService: ToolService,
        public mapService: MapService,
        private router: Router,
        private saveService: SaveService,
        private gameService: GameService,
    ) {}

    togglePlacementOptions(): void {
        this.placementOptionsOpen = !this.placementOptionsOpen;
        if (this.placementOptionsOpen) {
            this.textOptionsOpen = false;
        }
    }

    toggleTextOptions(): void {
        this.textOptionsOpen = !this.textOptionsOpen;
        if (this.textOptionsOpen) {
            this.placementOptionsOpen = false;
        }
    }

    selectTile(type: TileType): void {
        this.toolService.setTileType(type);
    }

    selectObject(type: MapObjectType): void {
        this.toolService.setMapObjectType(type);
    }

    isSelectedTile(type: TileType): boolean {
        return this.toolService.getToolType() === ToolType.Tile && this.toolService.getTileType() === type;
    }

    isSelectedObject(type: MapObjectType): boolean {
        return this.toolService.getToolType() === ToolType.Object && this.toolService.getMapObjectType() === type;
    }

    resetMap(): void {
        this.mapService.resetMap();
        this.toolService.defaultNumbers();
    }

    async saveMap(): Promise<void> {
        const game = this.mapService.getGameData() ?? this.buildGame();

        const errors = await this.saveService.validateBeforeSave(game);
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        try {
            if (game._id) {
                game.map = this.mapService.getMapData();
                game.name = game.map.name;
                game.description = game.map.description;
                await firstValueFrom(this.gameService.replaceGame(game._id, game));
                alert(`Jeu "${game.name}" modifié avec succès !`);
            } else {
                const savedGame = await firstValueFrom(this.gameService.addGame(game));
                alert(`Jeu "${savedGame.name}" créé avec succès !`);
            }
            this.router.navigate(['/admin']);
        } catch (err) {
            const action = game._id ? 'modification' : 'création';
            alert(`Erreur lors de la ${action} : ` + JSON.stringify(err));
        }
    }

    private buildGame(): Game {
        const mapData = this.mapService.getMapData();

        let minPlayers: number;
        let maxPlayers: number;

        switch (mapData.size) {
            case MapSize.Small:
                minPlayers = MIN_PLAYERS;
                maxPlayers = MAX_PLAYERS_SMALL;
                break;
            case MapSize.Medium:
                minPlayers = MIN_PLAYERS;
                maxPlayers = MAX_PLAYERS_MEDIUM;
                break;
            case MapSize.Large:
                minPlayers = MIN_PLAYERS;
                maxPlayers = MAX_PLAYERS_LARGE;
                break;
            default:
                minPlayers = MIN_PLAYERS;
                maxPlayers = MAX_PLAYERS_SMALL;
        }

        return {
            map: mapData,
            name: mapData.name,
            description: mapData.description,
            minPlayers,
            maxPlayers,
            visible: false,
        };
    }


    goToMenu(): void {
        this.router.navigate(['/home']);
    }
}
