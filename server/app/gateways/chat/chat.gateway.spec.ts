import { Game } from '@app/database/game/game.schema';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { ChatGateway } from './chat.gateway';
import { ChatEvents } from './chat.gateway.events';

describe('ChatGateway', () => {
    let gateway: ChatGateway;
    let logger: Logger;

    const mockLogger = {
        log: jest.fn(),
    };

    const mockServer = {
        emit: jest.fn(),
    } as unknown as Server;

    const mockSocket = {
        id: 'socket-id',
        broadcast: {
            emit: jest.fn(),
        },
    } as unknown as Socket;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                {
                    provide: Logger,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
        logger = module.get<Logger>(Logger);

        Object.defineProperty(gateway, 'server', {
            value: mockServer,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('refresh', () => {
        it('should broadcast Update event', () => {
            gateway.refresh(mockSocket);

            expect(mockSocket.broadcast.emit).toHaveBeenCalledWith(
                ChatEvents.Update,
            );
        });
    });

    describe('handleConnection', () => {
        it('should log connection', () => {
            gateway.handleConnection(mockSocket);

            expect(logger.log).toHaveBeenCalledWith(
                `Connexion par l'utilisateur avec id : ${mockSocket.id}`,
            );
        });
    });

    describe('handleDisconnect', () => {
        it('should log disconnection', () => {
            gateway.handleDisconnect(mockSocket);

            expect(logger.log).toHaveBeenCalledWith(
                `Déconnexion par l'utilisateur avec id : ${mockSocket.id}`,
            );
        });
    });

    describe('notifyElementAdded', () => {
        it('should emit element-added event with element', () => {
            const game: Game = {
                name: 'Test Game',
                description: 'Test description',
                minPlayers: 2,
                maxPlayers: 4,
                visible: true,
                map: undefined,
                imageUrl: undefined,
            };

            gateway.notifyElementAdded(game);

            expect(mockServer.emit).toHaveBeenCalledWith(
                'element-added',
                game,
            );
        });
    });
});