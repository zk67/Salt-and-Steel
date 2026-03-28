import { GameMode, Shrine, TileData } from '@common/interfaces/map.interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';


@Schema()
export class Game {
    @Prop({ required: true })
    tiles: TileData[][];

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    size: number;

    @Prop({ required: true })
    gameMode: GameMode;

    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    minPlayers: number;

    @Prop({ required: true })
    maxPlayers: number;

    @Prop({ required: true })
    visible: boolean;

    @Prop({ required: true })
    imageUrl: string;

    @Prop({ required: true })
    date: Date;

    @Prop({ required: true })
    shrine: Shrine[];
}
export type GameDocument = Game & Document;
export const gameSchema = SchemaFactory.createForClass(Game);

