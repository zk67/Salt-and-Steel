import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PopupComponent } from '@app/components/popup/popup.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { MapPreviewService } from '@app/services/map/map-preview.service';
import { MapService } from '@app/services/map/map.service';
import { SaveService } from '@app/services/save/save.service';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { GameMode, MapObjectType, TileType } from '@common/enums/map.enums';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-tools-sidebar',
    imports: [FormsModule, PopupComponent],
    templateUrl: './tools-sidebar.component.html',
    styleUrls: ['./tools-sidebar.component.scss'],
})
export class ToolsSidebarComponent implements OnInit {

    // Pour le html
    private _tileType = TileType;
    private _mapObjectType = MapObjectType;
    private _toolType = ToolType;
    private _mode = GameMode.Classic;
    gameMode = GameMode;

    showPopup = false;
    popupMessage = '';

    constructor(
        public toolService: ToolService,
        public mapService: MapService,
        private router: Router,
        private saveService: SaveService,
        private mapPreviewService: MapPreviewService,
    ) {}

    ngOnInit(): void {
        this._mode = this.mapService.getGameMode();
    }

    get mode(): GameMode {
        return this._mode;
    }

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
                if (!updatedGame) {
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
            this.popupMessage = err instanceof Error
                ? err.message
                : 'Une erreur est survenue lors de la communication avec le serveur. Veuillez réessayer.';
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
