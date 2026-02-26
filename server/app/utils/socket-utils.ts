import { Socket } from 'socket.io';

// Si plusieurs rooms, va juste retourner la première room trouvée
export const getRoomIdFromSocket = (socket: Socket): string | null => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id);
    return rooms.length > 0 ? rooms[0] : null;
};
