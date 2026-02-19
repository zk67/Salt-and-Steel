import { Component } from '@angular/core';
import { MapGameComponent } from '@app/components/map/map-game.component';

@Component({
    templateUrl: './game-page.component.html',
    styleUrls: ['./game-page.component.scss'],
    imports: [MapGameComponent],
})
export class GamePageComponent {}
