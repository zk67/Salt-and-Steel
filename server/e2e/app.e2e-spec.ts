import { GamesModule } from '@app/database/game/game.module';
import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

describe('AppController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [GamesModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    // Vérifier que le serveur démarre bien et que la route /games est accessible
    it('GET /api/games', async () => {
        return request(app.getHttpServer()).get('/api/games').expect(HttpStatus.OK);
    });
});
