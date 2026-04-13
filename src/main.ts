import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for frontend integration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
  const uploadsBaseUrl = process.env.UPLOADS_BASE_URL || '/uploads';
  app.useStaticAssets(join(process.cwd(), uploadsDir), {
    prefix: uploadsBaseUrl,
  });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const server = app.getHttpServer() as Server;
  // Story mutations (LLM + CSE + image + TTS) can run for minutes. Node’s HTTP
  // server may apply a finite request timeout; disable it so the socket is not
  // torn down while the handler is still working. Your dev proxy (Vite, etc.)
  // may still need its own `timeout` / `proxyTimeout`.
  server.requestTimeout = 0;
}
void bootstrap();
