import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

@Schema()
export class Game {

    // @Prop({ required: false })
    // map: MapObject;

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

}
export const gameSchema = SchemaFactory.createForClass(Game);

