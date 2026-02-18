import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SaveService } from '@app/services/save.service';
import { MapPreviewService } from '@app/services/map/map-preview.service';
import { MapService } from '@app/services/map/map.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { MapObjectType, TileType } from '@common/types/map.interface';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-tools-sidebar',
    imports: [FormsModule],
    templateUrl: './tools-sidebar.component.html',
    styleUrls: ['./tools-sidebar.component.scss'],
})
export class ToolsSidebarComponent {

    // Pour le html
    tileType = TileType;
    mapObjectType = MapObjectType;
    toolType = ToolType;

    constructor(
        public toolService: ToolService,
        public mapService: MapService,
        private router: Router,
        private saveService: SaveService,
        private mapPreviewService: MapPreviewService,
    ) {}

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
        const game = this.mapService.getGameData();
        if (!game) {
            alert('Aucune carte à sauvegarder.');
            return;
        }

        const errors = await this.saveService.validateBeforeSave(game);
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }

        game.imageUrl = await this.mapPreviewService.generatePreview(game);
        game.date = new Date();
        try {

            if (game._id) {
                await firstValueFrom(this.saveService.replaceGame(game._id, game));
                alert(`Jeu "${game.name}" modifié avec succès !`);
            } else {
                await firstValueFrom(this.saveService.addGame(game));
                alert(`Jeu "${game.name}" créé avec succès !`);
            }
            this.router.navigate(['/admin']);
        } catch (err) {
            const action = game._id ? 'modification' : 'création';
            alert(`Erreur lors de la ${action} : ` + JSON.stringify(err));
        }
    }

    goToMenu(): void {
        this.router.navigate(['/home']);
    }
}
