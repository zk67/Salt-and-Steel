import { Player } from '@common/interfaces/player.interface';

export class RoomPlayerStateService {
    private selectedAvatarsByRoom = new Map<string, Map<string, string>>();
    private usedNameSuffixesByRoom = new Map<string, Map<string, number>>();

    buildUniquePlayerName(roomId: string, requestedName: string, currentPlayers: Player[]): string {
        const baseName = requestedName.trim();
        const roomRegistry = this.getOrCreateRoomNameRegistry(roomId);

        const baseNameAlreadyUsed = currentPlayers.some((p) => p.name === baseName);
        const trackedSuffix = roomRegistry.get(baseName) ?? 1;

        if (!baseNameAlreadyUsed && trackedSuffix === 1) {
            roomRegistry.set(baseName, 1);
            return baseName;
        }

        const nextSuffix = trackedSuffix + 1;
        roomRegistry.set(baseName, nextSuffix);
        return `${baseName}-${nextSuffix}`;
    }

    removeRoomState(roomId: string): void {
        this.usedNameSuffixesByRoom.delete(roomId);
        this.selectedAvatarsByRoom.delete(roomId);
    }

    getUnavailableAvatars(roomId: string, currentPlayers: Player[]): string[] {
        const waitingRoomAvatars = currentPlayers.map((p) => p.imageUrl).filter(Boolean);
        const roomMap = this.selectedAvatarsByRoom.get(roomId);
        const selectedAvatars = roomMap ? Array.from(roomMap.values()) : [];
        const allAvatars = waitingRoomAvatars.concat(selectedAvatars);
        return [...new Set(allAvatars)];
    }

    setSelectedAvatar(roomId: string, clientId: string, avatar: string): void {
        if (!this.selectedAvatarsByRoom.has(roomId)) {
            this.selectedAvatarsByRoom.set(roomId, new Map<string, string>());
        }
        this.selectedAvatarsByRoom.get(roomId)?.set(clientId, avatar);
    }

    clearSelectedAvatar(roomId: string, clientId: string): void {
        const roomSelections = this.selectedAvatarsByRoom.get(roomId);
        if (roomSelections) {
            roomSelections.delete(clientId);
            if (roomSelections.size === 0) {
                this.selectedAvatarsByRoom.delete(roomId);
            }
        }
    }

    clearSelectedAvatarByClientId(clientId: string): string[] {
        const updatedRooms: string[] = [];
        for (const [roomId, selections] of this.selectedAvatarsByRoom.entries()) {
            if (!selections.has(clientId)) {
                continue;
            }
            selections.delete(clientId);
            updatedRooms.push(roomId);
            if (selections.size === 0) {
                this.selectedAvatarsByRoom.delete(roomId);
            }
        }
        return updatedRooms;
    }

    private getOrCreateRoomNameRegistry(roomId: string): Map<string, number> {
        let roomRegistry = this.usedNameSuffixesByRoom.get(roomId);
        if (!roomRegistry) {
            roomRegistry = new Map<string, number>();
            this.usedNameSuffixesByRoom.set(roomId, roomRegistry);
        }
        return roomRegistry;
    }
}
