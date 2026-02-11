import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game/game-card/game-card.component';
import { SaveService } from '@app/services/save.service';
import { SocketClientService } from '@app/services/socket-client.service';
import { Game } from '@common/classes/game';


@Component({
  selector: 'app-game-creation-page',
  imports: [GameCardComponent, RouterLink],
  templateUrl: './game-creation-page.component.html',
  styleUrl: './game-creation-page.component.scss',
})

export class GameCreationPageComponent implements OnInit, OnDestroy {
  private refreshListener: () => void;

  constructor(
    private saveService: SaveService,
    private socketService: SocketClientService,
  ) {}

  games: Game[] = [];

  ngOnInit(): void {
    this.getAllGames();

    this.refreshListener = () => {
      this.getAllGames();
    };

    this.socketService.on<Game>('update', this.refreshListener);
  }

  ngOnDestroy(): void {
    this.socketService.off('update', this.refreshListener);
  }

  getAllGames(): void {
    this.saveService.getAllVisibleGames().subscribe(games => {
      this.games = games;
    });
  }
}
