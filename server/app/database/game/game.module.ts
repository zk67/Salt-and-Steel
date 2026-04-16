import { GamesController } from '@app/database/game/controllers/games.controller';
import { Game, gameSchema } from '@app/database/game/game.schema';
import { GamesService } from '@app/database/game/services/game.service';
import { ChatGateway } from '@app/gateways/chat.gateway';
import { CurrentGameGateway } from '@app/gateways/current-game.gateway';
import { Gateway } from '@app/gateways/gateway';
import { ChatService } from '@app/gateways/services/chat.service';
import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { CurrentGameCombatService } from '@app/gateways/services/current-game-combat.service';
import { CurrentGameLobbyService } from '@app/gateways/services/current-game-lobby.service';
import { CurrentGamePlayService } from '@app/gateways/services/current-game-play.service';
import { CurrentGamesService } from '@app/service/current-games.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

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
    providers: [
        Gateway,
        CurrentGameGateway,
        Logger,
        GamesService,
        CurrentGamesService,
        ChatGateway,
        ChatService,
        CurrentGameBroadcastService,
        CurrentGameCombatService,
        CurrentGameLobbyService,
        CurrentGamePlayService,
    ],
})
export class GamesModule {}
