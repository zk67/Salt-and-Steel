import { GamesController } from '@app/database/game/controllers/games.controller';
import { Game, gameSchema } from '@app/database/game/game.schema';
import { GamesService } from '@app/database/game/services/game.service';
import { Gateway } from '@app/gateways/gateway';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CurrentGamesService } from '@app/current-games.service';


@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'),
            }),
        }),
        MongooseModule.forFeature([{ name: Game.name, schema: gameSchema }]),
    ],
    controllers: [GamesController],
    providers: [Gateway, Logger, GamesService, CurrentGamesService],
})
export class GamesModule {}
