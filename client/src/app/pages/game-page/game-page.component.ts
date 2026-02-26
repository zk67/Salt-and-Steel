import { Component, computed } from '@angular/core';
import { LeftSidebarComponent } from '@app/components/game/left-sidebar/left-sidebar.component';
import { RightSidebarComponent } from '@app/components/game/right-sidebar/right-sidebar.component';
import { MapGameComponent } from '@app/components/map/map-game.component';
import { TimeService } from '@app/services/time.service';

@Component({
    templateUrl: './game-page.component.html',
    styleUrls: ['./game-page.component.scss'],
    imports: [MapGameComponent, LeftSidebarComponent, RightSidebarComponent],
})
export class GamePageComponent {
    currentTime = computed(() => this.timerService.time());

    constructor(private timerService: TimeService) {}
}
