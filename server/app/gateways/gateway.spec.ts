import { GatewayEvents } from '@common/types/gateway.events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { Gateway } from './gateway';

/**
 * Description:
 * Ce fichier test permet de tester l'implementation des sockets (connexion/deconnexion) ainsi que la levée d'évènement
 * qui permet la mise a jour dynamique de l'affichage des Games dans les pages admin-page et game-creation-page
 * 
 * Fonctionnement:
 * 1) On déclare l'objet a tester ainsi que les objets nécessaires à son instanciation
 * 
 * 2) On instancie un mockLogger et un mockSocket qui vont permettre de tester les fonctions gateway
 * 
 * 3) On déclare une fonction 'beforeEache()' qui va s'executer avant chaque test, elle crée 
 *    un module qui s'occupera d'instancier les objets qu'on à déclarer en 1) , on récupere ensuite
 *    ces objets avec module.get()
 * 
 * 4) On déclare une fonction 'afterEach()' qui s'execute après chaque test permettant de remettre 
 *    les objets mocks à leur état d'origine avant le test suivant
 * 
 * 5) On crée pour chaque fonction un test unitaire associé qui utilise les mocks et les objets 
 *    récuperer en 3). Ces fonctions vont simuler une utilisation réelle des fonctions testées et 
 *    observer le comportement de celles-ci afin de voir si elles ont un comportement optimal, la methode expect() permet de
 *    vérifier qu'une fonction à bien été appelée et 'toHaveBeenCalledWith()' vérifie les arguments de celle-ci
 */

describe('ChatGateway', () => {
    let gateway: Gateway;
    let logger: Logger;

    const mockLogger = {
        log: jest.fn(),
    };

    const mockSocket = { id: 'socket-id', broadcast: { emit: jest.fn() } } as unknown as Socket;
    const mockServer = { emit: jest.fn() } as unknown as Server;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [Gateway, { provide: Logger, useValue: mockLogger }],
        }).compile();

        gateway = module.get<Gateway>(Gateway);
        logger = module.get<Logger>(Logger);
        Reflect.set(gateway, 'server', mockServer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('broadcastUpdate', () => {
        it('devrait émettre un événement update à tous les clients', () => {
            gateway.broadcastUpdate();
            expect(mockServer.emit).toHaveBeenCalledWith(GatewayEvents.Update);
        });
    });

    describe('handleConnection', () => {
        it('devrait afficher le id du socket lorsqu il se connecte', () => {

            gateway.handleConnection(mockSocket);
            expect(logger.log).toHaveBeenCalledWith(`Connexion par l'utilisateur avec id : ${mockSocket.id}`);
        });
    });

    describe('handleDisconnect', () => {
        it('devrait afficher le id du socket lorsqu il se deconnecte', () => {

            gateway.handleDisconnect(mockSocket);
            expect(logger.log).toHaveBeenCalledWith(`Déconnexion par l'utilisateur avec id : ${mockSocket.id}`);
        });
    });
});