import { GamesController } from '@app/database/game/controllers/games.controller';
import { GamesService } from '@app/database/game/services/game.service';
import { Gateway } from '@app/gateways/gateway';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { GamesModule } from './game/game.module';

/**
 * Description:
 * Ce fichier test vérifie que le GamesModule compile correctement et que sa configuration
 *  (imports, controllers et providers) est valide
 * 
 * Fonctionnement:
 * 1) On initialise le module a tester
 * 
 * 2) On vérifie dans chaque test si les dépendances importées et les objets exposés par le module 
 * (controllers et providers du module) sont correctement enregistrés en tant que dépendances
 */

describe('GamesModule', () => {
    let module: TestingModule;
    let connection: Connection;

    beforeAll(async () => {
        module = await Test.createTestingModule({ imports: [GamesModule] }).compile();
        connection = module.get<Connection>(getConnectionToken());
    });

    afterAll(async () => {
        connection.close();
        module.close();
    });

    it('devrait compiler le module correctement', () => {
        expect(module).toBeDefined();
    });

    it('devrait contenir le controller GamesController', () => {
        const controller = module.get<GamesController>(GamesController);
        expect(controller).toBeDefined();
    });

    it('devrait contenir le service GamesService', () => {
        const service = module.get<GamesService>(GamesService);
        expect(service).toBeDefined();
    });

    it('devrait contenir le provider Gateway', () => {
        const gateway = module.get<Gateway>(Gateway);
        expect(gateway).toBeDefined();
    });

    it('devrait importer ConfigModule et MongooseModule', () => {
        const configModule = module.get(ConfigModule);
        const mongooseModule = module.get(MongooseModule);

        expect(configModule).toBeDefined();
        expect(mongooseModule).toBeDefined();
    });
});
