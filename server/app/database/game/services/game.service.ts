import { Game, GameDocument } from '@app/database/game/game.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GamesService {
  constructor(@InjectModel(Game.name) private readonly gameModel: Model<GameDocument>) {}

  async addGame(game: Game): Promise<boolean> {
    const added = await this.gameModel.create(game);
    return added ? true : false;
  }

  async getAllGames(): Promise<Game[]> {
    return await this.gameModel.find().select('-tiles -minPlayers -maxPlayers').exec();
  }

  async getVisibleGames(): Promise<Game[]> {
    return await this.gameModel.find({ visible: true }).select('-tiles -visible -gameMode -size').exec();
  }

  async getOneGame(_id: string): Promise<Game> {
    return await this.gameModel.findById(_id).exec();
  }

  async updateGame(_id: string, data: Partial<Game>): Promise<Game> {
    return await this.gameModel.findByIdAndUpdate(_id, data, { new: true }).exec();
  }

  async deleteGame(_id: string): Promise<boolean> {
    const deleted = await this.gameModel.findByIdAndDelete(_id).exec();
    return deleted ? true : false;
  }

  async replaceGame(_id: string, game: Game): Promise<Game> {
    return await this.gameModel.findOneAndReplace({ _id }, game, { new: true }).exec();
  }
}
