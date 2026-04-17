import { CurrentGameBroadcastService } from '@app/gateways/services/current-game-broadcast.service';
import { CurrentGameLobbyService } from '@app/gateways/services/current-game-lobby.service';
import { CurrentGamePlayService } from '@app/gateways/services/current-game-play.service';
import { CurrentGamesService } from '@app/service/current-games.service';
import { getRoomIdFromSocket } from '@app/utils/socket-utils';
import {
    ActionOnTilePayload,
    ActiveCombatPayload,
    DebugMovePayload, MovePlayerPayload,
    PassFlagPayload,
    SubmitCombatPosturePayload,
    ToggleDebugPayload, UpdateFlagPayload,
} from '@common/interfaces/game.interface';
import { Player, Profile } from '@common/interfaces/player.interface';
import { GatewayEvents } from '@common/types/gateway.events';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CurrentGameCombatService } from './services/current-game-combat.service';

@WebSocketGateway({ cors: true })
@Injectable()
export class CurrentGameGateway implements OnGatewayInit, OnModuleInit {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly currentGamesService: CurrentGamesService,
        private readonly combatService: CurrentGameCombatService,
        private readonly broadcastService: CurrentGameBroadcastService,
        private readonly lobbyService: CurrentGameLobbyService,
        private readonly playService: CurrentGamePlayService,
    ) {}

    onModuleInit(): void {
        this.currentGamesService.setCombatGatewayService(this.combatService);
    }

    afterInit(): void {
        this.broadcastService.setServer(this.server);
        this.playService.bindTurnEmitter();
    }

    @SubscribeMessage(GatewayEvents.MovePlayer)
    handleMovePlayer(client: Socket, payload: MovePlayerPayload): void {
        this.playService.handleMovePlayer(client, payload);
    }

    @SubscribeMessage(GatewayEvents.StartGame)
    startGame(client: Socket): void {
        this.playService.startGame(client);
    }

    @SubscribeMessage(GatewayEvents.CreateGame)
    async createGame(client: Socket, data: { gameDbId: string; gameId: string }): Promise<boolean> {
        return this.lobbyService.createGame(client, data);
    }

    @SubscribeMessage(GatewayEvents.GetPlayersToGame)
    getPlayersToGame(client: Socket): void {
        this.lobbyService.getPlayersToGame(client);
    }

    @SubscribeMessage(GatewayEvents.GetJoinableGames)
    handleGetJoinableGames(client: Socket): void {
        this.lobbyService.emitJoinableGamesToClient(client);
    }

    @SubscribeMessage(GatewayEvents.EndTurnEarly)
    endTurnEarly(client: Socket): void {
        this.playService.endTurnEarly(client);
    }

    @SubscribeMessage(GatewayEvents.DebugMove)
    handleDebugMove(client: Socket, payload: DebugMovePayload): void {
        this.playService.handleDebugMove(client, payload);
    }

    @SubscribeMessage(GatewayEvents.Surrender)
    handleSurrender(client: Socket): void {
        this.lobbyService.handleSurrender(client);
    }

    @SubscribeMessage(GatewayEvents.KickPlayer)
    handleKickPlayer(client: Socket, payload: { playerId: string }): void {
        this.lobbyService.handleKickPlayer(client, payload);
    }

    @SubscribeMessage(GatewayEvents.AddPlayerToCurrentGame)
    handleAddPlayerToCurrentGame(client: Socket, player: Player): void {
        this.lobbyService.handleAddPlayerToCurrentGame(client, player);
    }

    @SubscribeMessage(GatewayEvents.GetUnavailableAvatars)
    handleGetUnavailableAvatars(client: Socket): void {
        this.lobbyService.handleGetUnavailableAvatars(client);
    }

    @SubscribeMessage(GatewayEvents.SelectAvatarInJoinForm)
    handleSelectAvatarInJoinForm(client: Socket, avatar: string): void {
        this.lobbyService.handleSelectAvatarInJoinForm(client, avatar);
    }

    @SubscribeMessage(GatewayEvents.ClearSelectedAvatarInJoinForm)
    handleClearSelectedAvatarInJoinForm(client: Socket): void {
        this.lobbyService.handleClearSelectedAvatarInJoinForm(client);
    }

    @SubscribeMessage(GatewayEvents.ToggleDebugMode)
    handleToggleDebugMode(client: Socket, payload: ToggleDebugPayload): void {
        this.playService.handleToggleDebugMode(client, payload);
    }

    @SubscribeMessage(GatewayEvents.ActionOnTile)
    handleActionOnTile(client: Socket, payload: ActionOnTilePayload): void {
        payload.playerId = client.id;
        this.playService.handleActionOnTile(client, payload);
    }

    @SubscribeMessage(GatewayEvents.StartCombat)
    handleStartCombat(client: Socket, payload: ActiveCombatPayload): void {
        this.playService.handleStartCombat(client, payload);
    }

    @SubscribeMessage(GatewayEvents.SubmitCombatPosture)
    handleSubmitCombatPosture(client: Socket, payload: SubmitCombatPosturePayload): void {
        this.playService.handleSubmitCombatPosture(client, payload);
    }

    @SubscribeMessage(GatewayEvents.AddVirtualPlayer)
    handleAddVirtualPlayer(client: Socket, payload: { profile: Profile.Aggressive | Profile.Defensive }): void {
        const mappedProfile: Profile =
            payload.profile === Profile.Aggressive
                ? Profile.Aggressive
                : Profile.Defensive;
        this.lobbyService.handleAddVirtualPlayer(client, { profile: mappedProfile });
    }

    @SubscribeMessage(GatewayEvents.RemoveVirtualPlayer)
    removeVirtualPlayer(client: Socket): void {
        this.lobbyService.handleRemoveVirtualPlayer(client);
    }

    @SubscribeMessage(GatewayEvents.PassFlag)
    handlePassFlag(client: Socket, payload: PassFlagPayload): void {
        if (this.playService.handlePassFlag(client, payload)) {
            this.broadcastService.emitHandlePassFlag(getRoomIdFromSocket(client), payload);
        }
    }

    @SubscribeMessage(GatewayEvents.PassFlagRequest)
    handlePassFlagRequest(client: Socket, payload: PassFlagPayload): void {
        const room = getRoomIdFromSocket(client);
        const game = this.currentGamesService.getGameByRoomId(room);
        const target = game?.players.find(player => player.id === payload.targetId);

        if (target?.isVirtual && target.hasFlag) {
            if (this.playService.handlePassFlag(client, payload)) {
                this.broadcastService.emitHandlePassFlag(room, payload);
            }
            return;
        }

        this.server.sockets.sockets.get(payload.targetId)?.emit(GatewayEvents.PassFlagRequest, payload);
    }

    @SubscribeMessage(GatewayEvents.PassFlagResponse)
    handlePassFlagResponse(client: Socket, payload: PassFlagPayload & { accepted: boolean }): void {
        if (!payload.accepted) return;

        const room = getRoomIdFromSocket(client);

        if (this.playService.handlePassFlag(client, payload)) {
            this.broadcastService.emitHandlePassFlag(room, payload);
        }
    }

    @SubscribeMessage(GatewayEvents.UpdateFlag)
    handleUpdateFlag(client: Socket, payload: UpdateFlagPayload): void {
        if (this.playService.handleUpdateFlag(client, payload)) {
            this.broadcastService.emitUpdateFlag(getRoomIdFromSocket(client), payload);
        }
    }
}