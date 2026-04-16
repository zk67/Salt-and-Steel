import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LeftSidebarComponent } from '@app/components/game/left-sidebar/left-sidebar.component';
import { RightSidebarComponent } from '@app/components/game/right-sidebar/right-sidebar.component';
import { MapGameComponent } from '@app/components/map/map-game.component';
import { ChoicePopupComponent } from '@app/components/popup/choice-popup.component';
import { PopupComponent } from '@app/components/popup/popup.component';
import { ZoneDeMessageComponent } from '@app/components/zone-de-message/zone-de-message.component';
import { APP_ROUTES } from '@app/const/routes-const';
import { GameService } from '@app/services/game/game.service';
import { PopupService } from '@app/services/popup.service';


@Component({
    templateUrl: './game-page.component.html',
    styleUrls: ['./game-page.component.scss'],
    imports: [MapGameComponent, LeftSidebarComponent, RightSidebarComponent, PopupComponent, ZoneDeMessageComponent, ChoicePopupComponent],
})
export class GamePageComponent implements OnInit {

    constructor(
        private gameService: GameService,
        public popupService: PopupService,
        private router: Router,
    ) {}

    ngOnInit(): void {
        const currentPlayer = this.gameService.clientPlayer();
        if (!currentPlayer) {
            this.router.navigate([APP_ROUTES.home]);
            return;
        }
    }
}
