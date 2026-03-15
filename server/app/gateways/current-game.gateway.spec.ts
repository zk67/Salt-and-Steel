import { CurrentGamesService } from '@app/current-games.service';
import { GamesService } from '@app/database/game/services/game.service';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { CurrentGameGateway } from './current-game.gateway';

/*
Stratégie de tests:
- On valide la communication WS utilisée par la join-page.
- On vérifie:
  1) que la gateway renvoie bien les parties joignables au client,
  2) qu'un joueur est refusé si la partie n'est plus joignable.
- Cas limite testé:
  tentative de rejoindre une partie verrouillée / commencée / pleine.
*/

describe('CurrentGameGateway', () => {
    let gateway: CurrentGameGateway;

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
    };

    const mockGamesService = {
        getOneGame: jest.fn(),
    };

    const mockServer = {
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as Server;

    const mockSocket = {
        id: 'socket-1',
        rooms: new Set(['socket-1', 'room-1']),
        emit: jest.fn(),
    } as unknown as Socket;

    beforeEach(async () => {
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

    it('handleAddPlayerToCurrentGame devrait refuser un joueur si la partie nest plus joignable', () => {
        mockCurrentGamesService.canJoinGame.mockReturnValue(false);

        gateway.handleAddPlayerToCurrentGame(mockSocket, {
            id: 'socket-1',
            name: 'Nouveau joueur',
        } as never);

        expect(mockSocket.emit).toHaveBeenCalledWith('joinCurrentGameResult', { success: false });
        expect(mockCurrentGamesService.addPlayerToGame).not.toHaveBeenCalled();
    });
});