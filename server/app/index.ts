import { GamesModule } from '@app/database/game/game.module';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

const bootstrap = async () => {
    const app = await NestFactory.create<NestExpressApplication>(GamesModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe());
    app.enableCors();

    if (process.env.NODE_ENV === 'production') {
        app.useStaticAssets(join(process.cwd(), 'client', 'dist', 'client'));
    }

    const config = new DocumentBuilder()
        .setTitle('Cadriciel Serveur')
        .setDescription('Serveur du projet de base pour le cours de LOG2995')
        .setVersion('1.0.0')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
};

bootstrap();
