import { CurrentGamesService } from '@app/service/current-games.service';
import { TurnPhase } from '@common/interfaces/game.interface';

/**
 * Description:
 * Ce fichier test permet de tester le service métier CurrentGamesService, qui gère
 * les parties courantes côté serveur. Il vérifie les règles de jointure, la liste
 * des parties joignables, la gestion des noms en doublon et la disponibilité des avatars.
 *
 * Fonctionnement:
 * 1) On déclare le service CurrentGamesService comme objet principal à tester.
 *
 * 2) Dans le beforeEach(), on instancie une nouvelle version du service afin de repartir
 *    d'un état propre avant chaque test unitaire.
 *
 * 3) Les tests créent des parties simulées puis ajoutent, retirent ou modifient
 *    des joueurs afin de reproduire différentes situations réelles côté serveur.
 *
 * 4) On utilise ensuite expect() pour vérifier que les règles métier sont respectées,
 *    par exemple:
 *    - seules les parties en attente et non pleines sont joignables;
 *    - une partie déjà commencée ne peut plus être rejointe;
 *    - un nom déjà utilisé reçoit un suffixe automatique;
 *    - les avatars choisis ou réservés sont marqués comme indisponibles;
 *    - un avatar redevient disponible lorsqu'un joueur quitte;
 *    - un nom redevient disponible lorsqu'un joueur quitte la salle d'attente.
 *
 * 5) Ce fichier met aussi en évidence une règle métier plus fine sur les suffixes:
 *    lorsqu'un joueur quitte, le système ne devrait pas forcément réutiliser un suffixe déjà attribué.
 *    Ce test permet donc aussi de détecter une dette technique ou un comportement métier incomplet.
 */

describe('CurrentGamesService', () => {
    let service: CurrentGamesService;

    beforeEach(() => {
        service = new CurrentGamesService();
    });

    it('getJoinableGames devrait retourner seulement les parties en attente avec de la place et le bon nombre de joueurs', () => {
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

        expect(result).toEqual([
            expect.objectContaining({
                roomId: 'room-waiting',
                playerCount: 2,
            }),
        ]);
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

    it('addPlayerToGame devrait suffixer le nom si le nom choisi existe déjà dans la salle d’attente', () => {
        service.createGame({ name: 'Waiting Game', maxPlayers: 4 } as never, 'room-1', 'g1');

        service.addPlayerToGame('room-1', { id: 'p1', name: 'Morgan' } as never);
        service.addPlayerToGame('room-1', { id: 'p2', name: 'Morgan' } as never);
        service.addPlayerToGame('room-1', { id: 'p3', name: 'Morgan' } as never);

        expect(service.getPlayersToGame('room-1').map((player) => player.name)).toEqual(['Morgan', 'Morgan-2', 'Morgan-3']);
    });

    it('getUnavailableAvatars devrait combiner les avatars des joueurs en attente et ceux réservés pendant la création', () => {
        service.createGame({ name: 'Waiting Game', maxPlayers: 4 } as never, 'room-1', 'g1');
        service.addPlayerToGame('room-1', { id: 'p1', name: 'A', imageUrl: 'avatar-1' } as never);
        service.setSelectedAvatar('room-1', 'socket-2', 'avatar-2');

        expect(service.getUnavailableAvatars('room-1')).toEqual(expect.arrayContaining(['avatar-1', 'avatar-2']));
    });

    it('clearSelectedAvatarByClientId devrait libérer l’avatar réservé lorsqu’un joueur quitte la création de personnage', () => {
        service.createGame({ name: 'Waiting Game', maxPlayers: 4 } as never, 'room-1', 'g1');
        service.setSelectedAvatar('room-1', 'socket-2', 'avatar-2');

        const updatedRooms = service.clearSelectedAvatarByClientId('socket-2');

        expect(updatedRooms).toEqual(['room-1']);
        expect(service.getUnavailableAvatars('room-1')).not.toContain('avatar-2');
    });

    it('devrait rendre le nom quitté disponible comme choix pour un nouvel arrivant', () => {
        service.createGame({ name: 'Waiting Game', maxPlayers: 4 } as never, 'room-1', 'g1');
        service.addPlayerToGame('room-1', { id: 'p1', name: 'Anne' } as never);
        service.removePlayerFromGame('room-1', 'p1');
        service.addPlayerToGame('room-1', { id: 'p2', name: 'Anne' } as never);

        expect(service.getPlayersToGame('room-1')[0].name).toBe('Anne');
    });

    it("ne devrait pas réutiliser un suffixe déjà attribué après l'abandon d'un joueur du même nom", () => {
        service.createGame({ name: 'Waiting Game', maxPlayers: 5 } as never, 'room-1', 'g1');
        service.addPlayerToGame('room-1', { id: 'p1', name: 'Anne' } as never);
        service.addPlayerToGame('room-1', { id: 'p2', name: 'Anne' } as never);
        service.removePlayerFromGame('room-1', 'p2');
        service.addPlayerToGame('room-1', { id: 'p3', name: 'Anne' } as never);

        expect(service.getPlayersToGame('room-1').map((player) => player.name)).toEqual(['Anne', 'Anne-3']);
    });
});
