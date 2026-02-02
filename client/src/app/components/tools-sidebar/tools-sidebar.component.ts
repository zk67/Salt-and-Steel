import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '@app/services/game.service';
import { MapService } from '@app/services/map/map.service';
import { SaveService } from '@app/services/save.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { Game } from '@common/classes/game';
import { MapData, MapObjectType, TileType } from '@common/types/map.interface';

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
        const errors = await this.saveService.validateBeforeSave();
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        const game = this.buildGame();

        if (game._id) {
            this.gameService.updateGame(game._id, game).subscribe({
                next: () => {
                    alert(`Jeu "${game.name}" modifié avec succès !`);
                    this.router.navigate(['/admin']);
                },
                error: (err) => alert('Erreur lors de la modification : ' + JSON.stringify(err)),
            });
        } else {
            this.gameService.addGame(game).subscribe({
                next: (savedGame) => {
                    alert(`Jeu "${savedGame.name}" créé avec succès !`);
                    this.router.navigate(['/admin']);
                },
                error: (err) => alert('Erreur lors de la création : ' + JSON.stringify(err)),
            });
        }

        // TODO : Image de prévisualisation
    }

    private buildGame(): Game {
        const mapData = this.mapService.getMapData();

        const plainMap: MapData = JSON.parse(JSON.stringify(mapData));

        return {
            map: plainMap,
            name: mapData.name,
            description: mapData.description,
            minPlayers: 2,
            maxPlayers: 4,
            visible: false,
        };
    }


    goToMenu(): void {
        this.router.navigate(['/home']);
    }
}
