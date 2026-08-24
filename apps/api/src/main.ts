import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Đọc refresh token từ httpOnly cookie.
  app.use(cookieParser());

  // Tất cả endpoint dưới /api/v1 (khớp Nginx proxy /api).
  app.setGlobalPrefix('api/v1');

  // Validate & strip DTO đầu vào — nền cho các phase sau.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // CORS chặt — cấu hình origin qua env ở các phase sau.
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true });

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`DebtFlow API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
