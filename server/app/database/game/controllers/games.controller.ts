import { GamesService } from '@app/database/game/services/game.service';
import { Gateway } from '@app/gateways/gateway';
import { Game } from '@common/interfaces/game.interface';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';

@Controller('games')
export class GamesController {
    constructor(
        private readonly gamesService: GamesService,
        private readonly gateway: Gateway,
    ) {}

    @Post()
    async addGame(@Body() game: Game) {
        const result = await this.gamesService.addGame(game);
        this.gateway.broadcastUpdate();
        return result;
    }

    @Get()
    getAllGames() {
        return this.gamesService.getAllGames();
    }

    @Get('visible')
    getVisibleGames() {
        return this.gamesService.getVisibleGames();
    }

    @Get(':id')
    getOneGame(@Param('id') _id: string) {
        return this.gamesService.getOneGame(_id);
    }

    @Patch(':id')
    async updateGame(@Param('id') _id: string, @Body() data: Partial<Game>) {
        const result = await this.gamesService.updateGame(_id, data);
        this.gateway.broadcastUpdate();
        return result;
    }

    @Delete(':id')
    async deleteGame(@Param('id') _id: string) {
        const result = await this.gamesService.deleteGame(_id);
        this.gateway.broadcastUpdate();
        return result;
    }

    @Put(':id')
    async replaceGame(@Param('id') _id: string, @Body() game: Game) {
        const result = await this.gamesService.replaceGame(_id, game);
        this.gateway.broadcastUpdate();
        return result;
    }
}
