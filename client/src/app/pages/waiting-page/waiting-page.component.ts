import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Player } from '@common/types/player.interface';

@Component({
    selector: 'app-waiting-page',
    templateUrl: './waiting-page.component.html',
    styleUrls: ['./waiting-page.component.scss'],
    imports: [RouterLink],
})
export class WaitingPageComponent {
    // player temporaire (va bugger quand il y aura une merge de l'interface de Player)
    player1: Player = {
        id: '1',
        name: 'Player 1',
        x: 5,
        y: 5,
        energy: 5,
        speed: 6,
        imageUrl: 'assets/avatars/avatar-1.png',
    };

    player2: Player = {
        id: '2',
        name: 'Player 2',
        x: 5,
        y: 5,
        energy: 5,
        speed: 6,
        imageUrl: 'assets/avatars/avatar-2.png',
    };

    player3: Player = {
        id: '3',
        name: 'Player 3',
        x: 5,
        y: 5,
        energy: 5,
        speed: 6,
        imageUrl: 'assets/avatars/avatar-3.png',
    };

    player4: Player = {
        id: '4',
        name: 'Player 4',
        x: 5,
        y: 5,
        energy: 5,
        speed: 6,
        imageUrl: 'assets/avatars/avatar-4.png',
    };

    player5: Player = {
        id: '5',
        name: 'Player 5',
        x: 5,
        y: 5,
        energy: 5,
        speed: 6,
        imageUrl: 'assets/avatars/avatar-5.png',
    };

    player6: Player = {
        id: '6',
        name: 'Player 6',
        x: 5,
        y: 5,
        energy: 5,
        speed: 6,
        imageUrl: 'assets/avatars/avatar-6.png',
    };

    players = [this.player1, this.player2, this.player3, this.player4, this.player5, this.player6];
}
