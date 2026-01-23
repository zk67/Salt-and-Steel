export interface Game {
    // map est comment car sinon je doit créer une map pour tester la BD
    _id?: string,
    //map: MapObject;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    visible: boolean;
}