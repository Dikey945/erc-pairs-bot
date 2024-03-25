import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {DataSource} from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const dataSource = app.get(DataSource);

  // Run migrations
  await dataSource.runMigrations();


  // Run migrations
  await dataSource.runMigrations();
  await app.listen(3000);
}
bootstrap();
