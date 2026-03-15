import { CurrentGamesService } from '@app/current-games.service';
import { TurnPhase } from '@common/types/game.interface';

/*
Stratégie de tests:
- On valide la logique métier derrière la join-page.
- Une partie joignable doit:
  1) avoir au moins une place disponible,
  2) être encore en attente (pas déjà commencée).
- Cas limite testé:
  une partie commencée avec encore des places libres ne doit pas apparaître
  dans la page "joindre une partie", sinon l'utilisateur pourrait tenter
  de rejoindre une partie déjà lancée.
*/

describe('CurrentGamesService', () => {
    let service: CurrentGamesService;

    beforeEach(() => {
        service = new CurrentGamesService();
    });

    it('getJoinableGames devrait retourner seulement les parties en attente avec de la place', () => {
        service.createGame({ name: 'Waiting Game', maxPlayers: 4 } as never, 'room-waiting', 'g1');
        service.createGame({ name: 'Started Game', maxPlayers: 4 } as never, 'room-started', 'g2');
        service.createGame({ name: 'Full Game', maxPlayers: 2 } as never, 'room-full', 'g3');

        service.addPlayerToGame('room-waiting', { id: 'p1', name: 'A' } as never);
        service.addPlayerToGame('room-waiting', { id: 'p2', name: 'B' } as never);

        service.addPlayerToGame('room-started', { id: 'p3', name: 'C' } as never);
        const startedGame = service.getGameByRoomId('room-started');
        expect(startedGame).toBeDefined();
        if (startedGame) {
            startedGame.currentPhase = TurnPhase.WaitTurn;
        }

        service.addPlayerToGame('room-full', { id: 'p4', name: 'D' } as never);
        service.addPlayerToGame('room-full', { id: 'p5', name: 'E' } as never);

        const result = service.getJoinableGames();

        expect(result.length).toBe(1);
        expect(result[0].roomId).toBe('room-waiting');
        expect(result[0].playerCount).toBe(2);
    });

    it('canJoinGame devrait retourner false si la partie est déjà commencée', () => {
        service.createGame({ name: 'Started Game', maxPlayers: 4 } as never, 'room-1', 'g1');
        service.addPlayerToGame('room-1', { id: 'p1', name: 'A' } as never);

        const game = service.getGameByRoomId('room-1');
        expect(game).toBeDefined();
        if (game) {
            game.currentPhase = TurnPhase.WaitTurn;
        }

        expect(service.canJoinGame('room-1')).toBe(false);
    });
});