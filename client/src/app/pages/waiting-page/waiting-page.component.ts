import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SocketClientService } from '@app/services/socket-client.service';
import { Player } from '@common/types/player.interface';

@Component({
    selector: 'app-waiting-page',
    templateUrl: './waiting-page.component.html',
    styleUrls: ['./waiting-page.component.scss'],
    imports: [RouterLink],
})
export class WaitingPageComponent {
    players: Player[] = [];

    private onPlayersToGame = (p: Player[]) => {
        this.players = p;
    };

    constructor(
        private socketService: SocketClientService,
    ) {}

    ngOnInit(): void {
        this.socketService.on('playersToGame', this.onPlayersToGame);
        this.socketService.send('getPlayersToGame'); // TODO: envoyer un payload si besoin (genre le roomId ou un truc) pour que le serveur puisse retourner les joueurs de la bonne partie
    }

    ngOnDestroy(): void {
        this.socketService.off('playersToGame', this.onPlayersToGame);
    }
}
