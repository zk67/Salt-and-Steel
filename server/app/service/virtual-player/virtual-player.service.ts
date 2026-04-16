import { PlayableGame } from '@app/interface/game.interface';
import { Player, Profile } from '@common/interfaces/player.interface';
import { VirtualPlayerTurnResult } from '@common/interfaces/virtual-player.interface';
import { VirtualPlayerCombatService } from './virtual-player-combat.service';
import { VirtualPlayerFactoryService } from './virtual-player-factory.service';
import { VirtualPlayerTurnService } from './virtual-player-turn.service';

export class VirtualPlayerService {
    private readonly factory = new VirtualPlayerFactoryService();
    private readonly turnService = new VirtualPlayerTurnService();
    private readonly combatService = new VirtualPlayerCombatService();

    createVirtualPlayer(id: string, profile: Profile, existingPlayers: Player[]): Player {
        return this.factory.createVirtualPlayer(id, profile, existingPlayers);
    }

    decideTurn(vp: Player, game: PlayableGame): VirtualPlayerTurnResult {
        return this.turnService.decideTurn(vp, game);
    }
}