import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopupComponent } from '@app/components/popup/popup.component';
import { Router } from '@angular/router';
import { APP_ROUTES } from '@app/const/routes-const';
import { MapPreviewService } from '@app/services/map/map-preview.service';
import { MapService } from '@app/services/map/map.service';
import { SaveService } from '@app/services/save/save.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { MapObjectType, TileType } from '@common/interfaces/map.interface';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-tools-sidebar',
    imports: [FormsModule, PopupComponent],
    templateUrl: './tools-sidebar.component.html',
    styleUrls: ['./tools-sidebar.component.scss'],
})
export class ToolsSidebarComponent {

    // Pour le html
    private _tileType = TileType;
    private _mapObjectType = MapObjectType;
    private _toolType = ToolType;

    showPopup = false;
    popupMessage = '';

    constructor(
        public toolService: ToolService,
        public mapService: MapService,
        private router: Router,
        private saveService: SaveService,
        private mapPreviewService: MapPreviewService,
    ) {}

    get tileType(): typeof TileType {
        return this._tileType;
    }

    get mapObjectType(): typeof MapObjectType {
        return this._mapObjectType;
    }

    get toolType(): typeof ToolType {
        return this._toolType;
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
        const game = this.mapService.getGameData();
        if (!game) {
            this.popupMessage = 'Aucune carte à sauvegarder.';
            this.showPopup = true;
            return;
        }

        const errors = await this.saveService.validateBeforeSave(game);
        if (errors.length > 0) {
            this.popupMessage = errors.join('\n');
            this.showPopup = true;
            return;
        }

        game.imageUrl = await this.mapPreviewService.generatePreview(game);
        game.date = new Date();
        try {
            if (game._id) {
                const updatedGame = await firstValueFrom(this.saveService.getGame(game._id));
                if (updatedGame === undefined || updatedGame === null) {
                    await firstValueFrom(this.saveService.addGame(game));
                    this.popupMessage = `Jeu "${game.name}" créé avec succès !`;
                    this.showPopup = true;
                } else {
                    await firstValueFrom(this.saveService.replaceGame(game._id, game));
                    this.popupMessage = `Jeu "${game.name}" modifié avec succès !`;
                    this.showPopup = true;
                }
            } else {
                await firstValueFrom(this.saveService.addGame(game));
                this.popupMessage = `Jeu "${game.name}" créé avec succès !`;
                this.showPopup = true;
            }

            this.router.navigate([APP_ROUTES.admin]);
        } catch (err) {
            const action = game._id ? 'modification' : 'création';
            this.popupMessage = `Erreur lors de la ${action} : ` + JSON.stringify(err);
            this.showPopup = true;
        }
    }

    goToMenu(): void {
        this.router.navigate([APP_ROUTES.home]);
    }

    closePopup(): void {
        this.showPopup = false;
        this.popupMessage = '';
    }
}
