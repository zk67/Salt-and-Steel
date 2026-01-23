// src/games/games.service.ts
import { Game, GameDocument } from '@app/database/game/game.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GamesService {
  private gameModel: Model<GameDocument>;

  constructor(@InjectModel(Game.name) gameModel: Model<GameDocument>) {
    this.gameModel = gameModel;
  }

  async addGame(game: Game): Promise<Game> {
    const newGame = new this.gameModel(game);
    return await newGame.save();
  }

  async getAllGames(): Promise<Game[]> {
    return await this.gameModel.find().exec();
  }

  async getOneGame(_id: string): Promise<Game> {
    return await this.gameModel.findById(_id).exec();
  }

  async updateGame(_id: string, data: Partial<Game>): Promise<Game> {
    return await this.gameModel.findByIdAndUpdate(_id, data, { new: true }).exec();
  }

  async deleteGame(_id: string): Promise<Game> {
    return await this.gameModel.findByIdAndDelete(_id).exec();
  }
}
