import { GamesService } from '@app/database/game/services/game.service';
import { Gateway } from '@app/gateways/gateway';
import { Game } from '@common/types/game.interface';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { GamesController } from './games.controller';

/**
 * Description:
 * Dans ce fichier on vérifie la bonne reception des requêtes par le serveur, leur traitement adéquat,
 * les réponses serveur ainsi que la communication contoller <--> service.
 *
 * Fonctionnement:
 * 1) On instancie un serveur NestJS 'app' qui va permettre d'envoyer des requêtes directement à notre serveur.
 * Dans ces tests le controller est tester de facon implicite, si le serveur répond correctement et que les methodes du services
 * sont correctement appelée avec les bon arguements alors le controller est tout bon.
 *
 * 2) Pour chaque methode du controller à tester on formule une requête correspondante, on observe ensuite les réponses,
 * les codes de retours, les arguments passés aux methodes du services et les objets retournés par ces mêmes méthodes.
 *
 */

describe('GamesController', () => {
    let app: INestApplication;
    let service: GamesService;
    const OK = 200;
    const CREATED = 201;

    const mockGame: Game = { _id: '22', name: 'Test game' } as Game;

    const mockGamesService = {
        addGame: jest.fn(),
        getAllGames: jest.fn(),
        getVisibleGames: jest.fn(),
        getOneGame: jest.fn(),
        updateGame: jest.fn(),
        deleteGame: jest.fn(),
        replaceGame: jest.fn(),
    };

    const mockGateway = {
        broadcastUpdate: jest.fn(),
    };

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [GamesController],
            providers: [
                { provide: GamesService, useValue: mockGamesService },
                { provide: Gateway, useValue: mockGateway },
            ],
        }).compile();

        app = module.createNestApplication();
        await app.init();
        service = module.get<GamesService>(GamesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    it('La requête POST /games devrait appeler addGame() du service et renvoyer la bonne réponse', async () => {
        jest.spyOn(mockGamesService, 'addGame').mockResolvedValue(true);

        const response = await request(app.getHttpServer()).post('/games').send({ name: 'Test game' }).expect(CREATED);

        expect(service.addGame).toHaveBeenCalledWith({ name: 'Test game' });
        expect(response.text).toEqual('true');
    });

    it('La requête GET /games devrait appeler getAllGames() du service et renvoyer la bonne réponse', async () => {
        jest.spyOn(mockGamesService, 'getAllGames').mockResolvedValue([mockGame]);

        const response = await request(app.getHttpServer()).get('/games').expect(OK);
        expect(service.getAllGames).toHaveBeenCalled();
        expect(response.body).toEqual([mockGame]);
    });

    it('La requête GET /games/visible devrait appeler getVisibleGames() du service et renvoyer les games visibles', async () => {
        jest.spyOn(mockGamesService, 'getVisibleGames').mockResolvedValue([mockGame]);

        const response = await request(app.getHttpServer()).get('/games/visible').expect(OK);
        expect(service.getVisibleGames).toHaveBeenCalled();
        expect(response.body).toEqual([mockGame]);
    });

    it('La requête GET /games/:id devrait appeler getOneGame() du service et returner la bonne Game', async () => {
        mockGamesService.getOneGame.mockResolvedValue(mockGame);

        const response = await request(app.getHttpServer()).get('/games/gameId').expect(OK);

        expect(service.getOneGame).toHaveBeenCalledWith('gameId');
        expect(response.body).toEqual(mockGame);
    });

    it('La requête PATCH /games/:id devrait appeler updateGame() du service et retourner la game mise à jour', async () => {
        const updateData = { name: 'Updated Game' };
        mockGamesService.updateGame.mockResolvedValue({ ...mockGame, ...updateData });

        const response = await request(app.getHttpServer()).patch('/games/gameId').send(updateData).expect(OK);

        expect(service.updateGame).toHaveBeenCalledWith('gameId', updateData);
        expect(response.body.name).toEqual('Updated Game');
    });

    it('La requête DELETE /games/:id devrait appeler deleteGame() du service et retourner true (suppression appliquée)', async () => {
        mockGamesService.deleteGame.mockResolvedValue(true);

        const response = await request(app.getHttpServer()).delete('/games/gameId').expect(OK);

        expect(service.deleteGame).toHaveBeenCalledWith('gameId');
        expect(response.text).toEqual('true');
    });

    it('La requête PUT /games/:id devrait appeler replaceGame() du service et retourner la Game remplacée', async () => {
        mockGamesService.replaceGame.mockResolvedValue(mockGame);

        const response = await request(app.getHttpServer()).put('/games/gameId').send(mockGame).expect(OK);

        expect(service.replaceGame).toHaveBeenCalledWith('gameId', mockGame);
        expect(response.body).toEqual(mockGame);
    });
});
