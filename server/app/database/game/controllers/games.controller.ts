import { Game } from '@app/database/game/game.schema';
import { GamesService } from '@app/database/game/services/game.service';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

@Controller('games')
export class GamesController {
    private gamesService: GamesService;
    constructor(gamesService: GamesService) {
        this.gamesService = gamesService;
    }

    @Post()
    addGame(@Body() game: Game) {
        return this.gamesService.addGame(game);
    }

    @Get()
    getAllGames() {
        return this.gamesService.getAllGames();
    }

    @Get(':id')
    getOneGame(@Param('id') _id: string) {
        return this.gamesService.getOneGame(_id);
    }

    @Patch(':id')
    updateGame(@Param('id') _id: string, @Body() data: Partial<Game>) {
        return this.gamesService.updateGame(_id, data);
    }

    @Delete(':id')
    deleteGame(@Param('id') _id: string) {
        return this.gamesService.deleteGame(_id);
    }
}
