import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TileType, MapObjectType } from '@common/types/map.interface';
import { ToolService, ToolType } from '@app/services/tool/tool.service';
import { MapService } from '@app/services/map/map.service';

@Component({
    selector: 'app-tools-sidebar',
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
    }

    saveMap(): void {
        // On va save dans la db ici
    }

    goToMenu(): void {
        this.router.navigate(['/home']);
    }
}
