import { TestBed } from '@angular/core/testing';
import { GatewayEvents } from '@common/types/gateway.events';
import { Socket } from 'socket.io-client';
import { SocketClientService } from './socket-client.service';

/**
 * Description:
 * Ce fichier teste le SocketClientService et de son fonctionnement pour la communication
 * entre le client Angular et le serveur de jeu via Socket.IO.
 * Il vérifie que chaque méthode publique du service (isSocketAlive, connect, disconnect, on, off, send)
 * se comporte correctement.
 *
 * Fonctionnement:
 * 1) On déclare le service à tester ainsi que le mockSocket nécessaire à la simulation du socket.
 *
 * 2) On instancie un mockSocket qui simule un objet Socket.IO avec des spies Jasmine afin de tester le service sans établir de connexion réseau.
 *
 * 3) On déclare une fonction beforeEach() qui s'exécute avant chaque test et une fonction afterEach()
 *    qui s'exécute après chaque test afin de remettre le TestBed à son état d'origine et éviter des problèmes entre tests.
 *
 * 4) On crée pour chaque méthode du service un test unitaire associé qui utilise le mockSocket et le service
 *    récupéré en 3). Ces tests simulent une utilisation des méthodes et observent leur comportement.
 */

const createMockSocket = () => ({
    connected: false,
    disconnect: jasmine.createSpy('disconnect'),
    on: jasmine.createSpy('on'),
    off: jasmine.createSpy('off'),
    emit: jasmine.createSpy('emit'),
});

describe('SocketClientService', () => {
    let service: SocketClientService;
    let mockSocket: ReturnType<typeof createMockSocket>;

    beforeEach(() => {
        mockSocket = createMockSocket();
        TestBed.configureTestingModule({ providers: [SocketClientService] });
        service = TestBed.inject(SocketClientService);
        service.connect();
        service['socket'] = mockSocket as unknown as Socket;
    });

    afterEach(() => TestBed.resetTestingModule());

    it('devrait être créé', () => {
        expect(service).toBeTruthy();
    });

    it('connect() devrait assigner un socket', () => {
        const fresh = new SocketClientService();
        fresh.connect();
        expect(fresh['socket']).toBeDefined();
        fresh['socket'].disconnect();
    });

    it('disconnect() devrait appeler socket.disconnect()', () => {
        service.disconnect();
        expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });

    it('isSocketAlive() devrait retourner false si non connecté', () => {
        mockSocket.connected = false;
        expect(service.isSocketAlive()).toBeFalsy();
    });

    it('isSocketAlive() devrait retourner true si connecté', () => {
        mockSocket.connected = true;
        expect(service.isSocketAlive()).toBeTruthy();
    });

    it('on() devrait appeler socket.on avec le bon événement et callback', () => {
        const callback = jasmine.createSpy('callback');
        service.on(GatewayEvents.Update, callback);
        expect(mockSocket.on).toHaveBeenCalledWith(GatewayEvents.Update, callback);
    });

    it('off() devrait appeler socket.off avec le bon événement et callback', () => {
        const callback = jasmine.createSpy('callback');
        service.off(GatewayEvents.Update, callback);
        expect(mockSocket.off).toHaveBeenCalledWith(GatewayEvents.Update, callback);
    });

    it('send() devrait inclure data et callback dans emit si fournis', () => {
        const callback = jasmine.createSpy('callback');
        service.send(GatewayEvents.MovePlayer, { type: 'jump' }, callback);
        expect(mockSocket.emit).toHaveBeenCalledWith(GatewayEvents.MovePlayer, { type: 'jump' }, callback);
    });
});
