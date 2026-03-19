import { CurrentGamesService } from '@app/service/current-games.service';
import { GamesService } from '@app/database/game/services/game.service';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { CurrentGameGateway } from './current-game.gateway';

/**
 * Description:
 * Ce fichier test permet de tester la passerelle socket CurrentGameGateway, responsable
 * de la gestion temps réel des parties en attente, de la jonction à une partie,
 * des avatars sélectionnés et des mises à jour envoyées aux clients.
 *
 * Fonctionnement:
 * 1) On déclare l'objet à tester CurrentGameGateway ainsi que plusieurs mocks:
 *    un logger, un service CurrentGamesService, un GamesService, un serveur socket
 *    et un client socket simulé.
 *
 * 2) On crée un mockServer et un roomEmitter afin de reproduire les émissions globales
 *    et les émissions ciblées dans une room spécifique.
 *
 * 3) Dans le beforeEach(), on crée un module NestJS de test qui instancie la gateway
 *    avec ses dépendances mockées. On injecte ensuite manuellement le serveur socket
 *    dans la gateway.
 *
 * 4) Dans le afterEach(), on remet les mocks à zéro avec jest.clearAllMocks()
 *    afin d'éviter qu'un test influence les suivants.
 *
 * 5) Les tests vérifient:
 *    - l'envoi de la liste des parties joignables;
 *    - le refus de joindre une partie verrouillée ou non joignable;
 *    - l'ajout d'un joueur dans une partie;
 *    - la diffusion des joueurs présents dans la salle d'attente;
 *    - la mise à jour globale de la liste des parties disponibles;
 *    - la mise à jour en temps réel des avatars indisponibles;
 *    - la libération d'un avatar lorsqu'un joueur quitte;
 *    - et la mise à jour correcte des clients lorsqu'un abandon survient.
 */

describe('CurrentGameGateway', () => {
    let gateway: CurrentGameGateway;
    let roomEmitter: { emit: jest.Mock };

    const mockLogger = {
        log: jest.fn(),
        warn: jest.fn(),
    };

    const mockCurrentGamesService = {
        setEmitCallback: jest.fn(),
        getJoinableGames: jest.fn(),
        canJoinGame: jest.fn(),
        addPlayerToGame: jest.fn(),
        getGameByRoomId: jest.fn(),
        getPlayersToGame: jest.fn(),
        getUnavailableAvatars: jest.fn(),
        setSelectedAvatar: jest.fn(),
        clearSelectedAvatar: jest.fn(),
        removePlayerFromGame: jest.fn(),
        removeGame: jest.fn(),
        isDebugMode: jest.fn(),
    };

    const mockGamesService = {
        getOneGame: jest.fn(),
    };

    const mockServer = {
        emit: jest.fn(),
        to: jest.fn(),
    } as unknown as Server;

    const mockSocket = {
        id: 'socket-1',
        rooms: new Set(['socket-1', 'room-1']),
        emit: jest.fn(),
    } as unknown as Socket;

    beforeEach(async () => {
        roomEmitter = { emit: jest.fn() };
        (mockServer.to as jest.Mock).mockReturnValue(roomEmitter);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CurrentGameGateway,
                { provide: Logger, useValue: mockLogger },
                { provide: CurrentGamesService, useValue: mockCurrentGamesService },
                { provide: GamesService, useValue: mockGamesService },
            ],
        }).compile();

        gateway = module.get<CurrentGameGateway>(CurrentGameGateway);
        Reflect.set(gateway, 'server', mockServer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('handleGetJoinableGames devrait envoyer joinableGames au client', () => {
        const games = [
            {
                roomId: 'room-1',
                game: { name: 'Partie A', maxPlayers: 4 },
                playerCount: 2,
            },
        ];
        mockCurrentGamesService.getJoinableGames.mockReturnValue(games);

        gateway.handleGetJoinableGames(mockSocket);

        expect(mockSocket.emit).toHaveBeenCalledWith('joinableGames', games);
    });

    it('handleAddPlayerToCurrentGame devrait refuser un joueur si la partie n’est plus joignable', () => {
        mockCurrentGamesService.canJoinGame.mockReturnValue(false);

        gateway.handleAddPlayerToCurrentGame(mockSocket, {
            id: 'socket-1',
            name: 'Nouveau joueur',
        } as never);

        expect(mockSocket.emit).toHaveBeenCalledWith('joinCurrentGameResult', { success: false });
        expect(mockCurrentGamesService.addPlayerToGame).not.toHaveBeenCalled();
    });

    it('handleAddPlayerToCurrentGame devrait ajouter le joueur, diffuser la salle d’attente et mettre à jour les parties joignables', () => {
        mockCurrentGamesService.canJoinGame.mockReturnValue(true);
        mockCurrentGamesService.getPlayersToGame.mockReturnValue([{ id: 'socket-1', name: 'Anne' }]);
        mockCurrentGamesService.getJoinableGames.mockReturnValue([{ roomId: 'room-1', game: { name: 'Partie A' }, playerCount: 1 }]);
        mockCurrentGamesService.getGameByRoomId.mockReturnValue(undefined);

        gateway.handleAddPlayerToCurrentGame(mockSocket, {
            id: 'socket-1',
            name: 'Anne',
            isOrganizer: false,
        } as never);

        expect(mockCurrentGamesService.addPlayerToGame).toHaveBeenCalledWith('room-1', expect.objectContaining({ name: 'Anne' }));
        expect(roomEmitter.emit).toHaveBeenCalledWith('playersToGame', [{ id: 'socket-1', name: 'Anne' }]);
        expect(mockSocket.emit).toHaveBeenCalledWith('joinCurrentGameResult', { success: true });
        expect(mockServer.emit).toHaveBeenCalledWith('joinableGames', [{ roomId: 'room-1', game: { name: 'Partie A' }, playerCount: 1 }]);
    });

    it('handleSelectAvatarInJoinForm devrait diffuser les avatars indisponibles en temps réel', () => {
        mockCurrentGamesService.getUnavailableAvatars.mockReturnValue(['avatar-1']);

        gateway.handleSelectAvatarInJoinForm(mockSocket, 'avatar-1');

        expect(mockCurrentGamesService.setSelectedAvatar).toHaveBeenCalledWith('room-1', 'socket-1', 'avatar-1');
        expect(roomEmitter.emit).toHaveBeenCalledWith('unavailableAvatars', ['avatar-1']);
    });

    it('handleClearSelectedAvatarInJoinForm devrait libérer un avatar et diffuser la mise à jour', () => {
        mockCurrentGamesService.getUnavailableAvatars.mockReturnValue([]);

        gateway.handleClearSelectedAvatarInJoinForm(mockSocket);

        expect(mockCurrentGamesService.clearSelectedAvatar).toHaveBeenCalledWith('room-1', 'socket-1');
        expect(roomEmitter.emit).toHaveBeenCalledWith('unavailableAvatars', []);
    });

    it('handleSurrender devrait retirer un joueur non organisateur, mettre à jour la salle et rendre son avatar disponible', () => {
        mockCurrentGamesService.getGameByRoomId.mockReturnValue({
            players: [{ id: 'socket-1', isOrganizer: false }],
            idHost: 'host-1',
        });
        mockCurrentGamesService.removePlayerFromGame.mockReturnValue(true);
        mockCurrentGamesService.getPlayersToGame.mockReturnValue([]);
        mockCurrentGamesService.getUnavailableAvatars.mockReturnValue([]);
        mockCurrentGamesService.getJoinableGames.mockReturnValue([]);

        gateway.handleSurrender(mockSocket);

        expect(roomEmitter.emit).toHaveBeenCalledWith('removePlayer', { playerId: 'socket-1' });
        expect(roomEmitter.emit).toHaveBeenCalledWith('playersToGame', []);
        expect(roomEmitter.emit).toHaveBeenCalledWith('unavailableAvatars', []);
        expect(mockServer.emit).toHaveBeenCalledWith('joinableGames', []);
    });
});
