import { Game } from '@app/database/game/game.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Query } from 'mongoose';
import { GamesService } from './game.service';

/**
 * Description:
 * Ce fichier permet de tester les méthodes du service responsables de l'ajout, la récupération, la modification et la supression
 * des games en simulant l'accès à la base de donnée.
 * 
 * Fonctionnement:
 * 1) on déclare l'objet service à tester, le model qui représente le model mongoose pour le schéma de Game ainsi que son
 *    mockGameModel en plus de l'objet mockGame.
 * 
 * 2) dans beforeEach on crée un module de test et on récupere de ce module les objets service et model avant chaque test
 * unitaire
 * 
 * 3) dans afterEach on s'assure de nettoyer les mocks pour éviter que les tests s'affectent entre eux
 * 
 * 4) on teste chaque fonction de l'objet service une par une, en vérifiant qu'elles appellent les bonnes fonctions du faux model
 *    mongoose, qu'elles lui transmettent les bonnes données et qu'elles retournent les bonnes données aussi.
 * 
 */

describe('GamesService', () => {
    let service: GamesService;
    let model: Model<Game>;

    const mockGame = {
        name: 'Test game',
        genre: 'Aventure',
    } as unknown as Game;

    const mockGameModel = {
        create: jest.fn().mockResolvedValue({ _id: '1', mockGame }),
        find: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        findByIdAndUpdate: jest.fn().mockReturnThis(),
        findByIdAndDelete: jest.fn().mockReturnThis(),
        findOneAndReplace: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockGame),
    };

    function execMockFunction<T>(arg: T) {
        const execSpy = jest.fn().mockResolvedValue(arg);
        const query = { exec: execSpy } as unknown as Query<T[], T>;
        return { execSpy, query };
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GamesService, { provide: getModelToken(Game.name), useValue: mockGameModel }],
        }).compile();

        service = module.get<GamesService>(GamesService);
        model = module.get<Model<Game>>(getModelToken(Game.name));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('devrait compiler le service correctement', () => {
        expect(service).toBeDefined();
    });

    it('addGame devrait appeler create pour ajouter une game dans la base de donnée et retourner la nouvelle game', async () => {
        jest.spyOn(mockGameModel, 'create').mockResolvedValueOnce(mockGame);

        const result = await service.addGame(mockGame);
        expect(result).toEqual(true);
        expect(mockGameModel.create).toHaveBeenCalledWith(mockGame);
    });

    it('addGame devrait retourner false si la création échoue', async () => {
        jest.spyOn(mockGameModel, 'create').mockResolvedValue(null);

        const result = await service.addGame(mockGame);
        expect(result).toEqual(false);
        expect(mockGameModel.create).toHaveBeenCalledWith(mockGame);
    });

    it('getAllGames devrait appeler find pour retourner toutes les games de la base de donnée', async () => {
        const { execSpy, query } = execMockFunction<Game[]>([mockGame]);
        jest.spyOn(model, 'find').mockReturnValue(query);

        const result = await service.getAllGames();

        expect(result).toEqual([mockGame]);
        expect(model.find).toHaveBeenCalled();
        expect(execSpy).toHaveBeenCalled();
    });

    it('getOneGame devrait appeler findById, lui passer le id de la game cible et retourner cette game', async () => {
        const { execSpy, query } = execMockFunction<Game>(mockGame);
        jest.spyOn(model, 'findById').mockReturnValue(query);

        const result = await service.getOneGame('1');

        expect(result).toEqual(mockGame);
        expect(model.findById).toHaveBeenCalledWith('1');
        expect(execSpy).toHaveBeenCalled();
    });

    it('updateGame devrait appeler findByIdAndUpdate, lui passer le id de la game cible et les données pour la mise à jour', async () => {
        const { execSpy, query } = execMockFunction<Game>(mockGame);
        jest.spyOn(model, 'findByIdAndUpdate').mockReturnValue(query);

        const result = await service.updateGame('1', { name: 'gameChangee' });

        expect(result).toEqual(mockGame);
        expect(model.findByIdAndUpdate).toHaveBeenCalledWith('1', { name: 'gameChangee' }, { new: true });
        expect(execSpy).toHaveBeenCalled();
    });

    it('deleteGame devrait appeler findByIdAndDelete, lui passer le id de la game cible et retourner true (suppression réussie)', async () => {
        const { execSpy, query } = execMockFunction<Game>(mockGame);
        jest.spyOn(model, 'findByIdAndDelete').mockReturnValue(query);

        const result = await service.deleteGame('1');

        expect(result).toEqual(true);
        expect(model.findByIdAndDelete).toHaveBeenCalledWith('1');
        expect(execSpy).toHaveBeenCalled();
    });

    it('deleteGame devrait appeler findByIdAndDelete, lui passer le id de la game cible et retourner false (supression non effectuée)', async () => {
        const { execSpy, query } = execMockFunction<Game>(null);
        jest.spyOn(model, 'findByIdAndDelete').mockReturnValue(query);

        const result = await service.deleteGame('1');

        expect(result).toEqual(false);
        expect(model.findByIdAndDelete).toHaveBeenCalledWith('1');
        expect(execSpy).toHaveBeenCalled();
    });

    it('replaceGame devrait appeler findOneAndReplace, lui passer le id de la game cible et retourner la game remplacée', async () => {
        const { execSpy, query } = execMockFunction<Game>(mockGame);
        jest.spyOn(model, 'findOneAndReplace').mockReturnValue(query);

        const result = await service.replaceGame('1', mockGame);

        expect(result).toEqual(mockGame);
        expect(model.findOneAndReplace).toHaveBeenCalledWith({ _id: '1' }, mockGame, { new: true });
        expect(execSpy).toHaveBeenCalled();
    });
});