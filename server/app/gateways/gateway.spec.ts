import { CurrentGamesService } from '@app/service/current-games.service';
import { GatewayEvents } from '@common/types/gateway.events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { Gateway } from './gateway';

/**
 * Description:
 * Ce fichier test permet de tester la gateway socket générique du serveur,
 * notamment les connexions, déconnexions, la gestion des rooms et les mises à jour
 * liées à la libération des avatars temporairement réservés.
 *
 * Fonctionnement:
 * 1) On déclare l'objet à tester Gateway, ainsi que les mocks nécessaires
 *    comme le logger, le CurrentGamesService, un socket client simulé
 *    et un serveur socket simulé.
 *
 * 2) On crée un roomEmitter qui permettra de simuler les émissions dans une room précise,
 *    par exemple pour diffuser la nouvelle liste des avatars indisponibles après une déconnexion.
 *
 * 3) Dans le beforeEach(), on construit un module NestJS de test, on récupère
 *    les objets instanciés avec module.get() et on injecte le mock du serveur socket
 *    dans la gateway.
 *
 * 4) Dans le afterEach(), on réinitialise tous les mocks avec jest.clearAllMocks()
 *    pour garantir l'indépendance des tests.
 *
 * 5) Les tests unitaires vérifient:
 *    - qu'un événement global de mise à jour peut être diffusé;
 *    - que la connexion d'un utilisateur est bien journalisée;
 *    - que la déconnexion libère les avatars temporairement réservés;
 *    - que les rooms concernées reçoivent la nouvelle liste d'avatars indisponibles;
 *    - qu'un utilisateur peut rejoindre une room;
 *    - et qu'il peut aussi la quitter correctement.
 */

describe('Gateway', () => {
    let gateway: Gateway;
    let logger: Logger;
    let roomEmitter: { emit: jest.Mock };

    const mockLogger = {
        log: jest.fn(),
        warn: jest.fn(),
    };
    const mockCurrentGamesService = {
        clearSelectedAvatarByClientId: jest.fn().mockReturnValue([]),
        getUnavailableAvatars: jest.fn().mockReturnValue([]),
    };

    const mockSocket = {
        id: 'socket-id',
        broadcast: { emit: jest.fn() },
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
    } as unknown as Socket;
    const mockServer = { emit: jest.fn(), to: jest.fn() } as unknown as Server;

    beforeEach(async () => {
        roomEmitter = { emit: jest.fn() };
        (mockServer.to as jest.Mock).mockReturnValue(roomEmitter);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                Gateway,
                { provide: Logger, useValue: mockLogger },
                { provide: CurrentGamesService, useValue: mockCurrentGamesService },
            ],
        }).compile();

        gateway = module.get<Gateway>(Gateway);
        logger = module.get<Logger>(Logger);
        Reflect.set(gateway, 'server', mockServer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('broadcastUpdate devrait émettre un événement update à tous les clients', () => {
        gateway.broadcastUpdate();
        expect(mockServer.emit).toHaveBeenCalledWith(GatewayEvents.Update);
    });

    it('handleConnection devrait afficher l’id du socket lorsqu’il se connecte', () => {
        gateway.handleConnection(mockSocket);
        expect(logger.log).toHaveBeenCalledWith(`Connexion par l'utilisateur avec id : ${mockSocket.id}`);
    });

    it('handleDisconnect devrait libérer les avatars réservés et diffuser les mises à jour', () => {
        mockCurrentGamesService.clearSelectedAvatarByClientId.mockReturnValue(['room-1', 'room-2']);
        mockCurrentGamesService.getUnavailableAvatars.mockImplementation((roomId: string) =>
            roomId === 'room-1' ? ['avatar-1'] : ['avatar-2'],
        );

        gateway.handleDisconnect(mockSocket);

        expect(mockCurrentGamesService.clearSelectedAvatarByClientId).toHaveBeenCalledWith('socket-id');
        expect(mockServer.to).toHaveBeenCalledWith('room-1');
        expect(mockServer.to).toHaveBeenCalledWith('room-2');
        expect(roomEmitter.emit).toHaveBeenCalledWith('unavailableAvatars', ['avatar-2']);
        expect(logger.log).toHaveBeenCalledWith(`Déconnexion par l'utilisateur avec id : ${mockSocket.id}`);
    });

    it('handleJoinRoom devrait joindre la room demandée', () => {
        gateway.handleJoinRoom(mockSocket, 'room-1');
        expect(mockSocket.join).toHaveBeenCalledWith('room-1');
    });

    it('handleLeaveRoom devrait quitter la room demandée', () => {
        gateway.handleLeaveRoom(mockSocket, 'room-1');
        expect(mockSocket.leave).toHaveBeenCalledWith('room-1');
    });
});
