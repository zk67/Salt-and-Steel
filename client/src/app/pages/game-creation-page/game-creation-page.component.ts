import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game/game-card/game-card.component';
import { GameService } from '@app/services/game.service';
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
    private gameService: GameService,
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
    this.gameService.getAllGames().subscribe(games => {
      this.games = games;
    });
  }

  addGame(game: Game): void {
    if (this.games.some(x => x._id === game._id)) return;

    this.gameService.addGame(game).subscribe(() => {
      this.getAllGames();
    });
  }

  getGame(_id: string): void {
    if (this.games.some(x => x._id === _id)) return;

    this.gameService.getGame(_id).subscribe(oneGame => {
      this.games.push(oneGame);
    });
  }

  deleteGame(_id: string): void {
    const y = this.games.find((x) => x._id === _id);
    if (y && !this.games.some(x => x._id === y._id)) return;

    this.gameService.deleteGame(_id).subscribe(() => {
      this.getAllGames();
    });
  }

  changeGameVisibility(_id: string, visibility: boolean): void {
    if (!this.games.find(game => game._id === _id)) return;

    this.gameService.updateGameVisibility(_id, visibility).subscribe(() => {
      this.getAllGames();
    });
  }
}