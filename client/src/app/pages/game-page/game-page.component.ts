import { Component, computed } from '@angular/core';
import { MapGameComponent } from '@app/components/map/map-game.component';
import { TimeService } from '@app/services/time.service';

@Component({
    templateUrl: './game-page.component.html',
    styleUrls: ['./game-page.component.scss'],
    imports: [MapGameComponent],
})
export class GamePageComponent {
    currentTime = computed(() => this.timerService.time());

    constructor(private timerService: TimeService) {}
}
