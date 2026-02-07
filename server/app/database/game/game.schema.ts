import { MapData } from '@common/types/map.interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {

    @Prop({ type: Object, required: false })
    map: MapData;

    @Prop({ required: true })
    name: string;

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

    @Prop({ required: true})
    date: Date;
}
export const gameSchema = SchemaFactory.createForClass(Game);

