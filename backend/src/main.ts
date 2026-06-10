import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AllExceptionsFilter } from '@shared/filters/all-exceptions.filter';
import { RequestIdMiddleware } from '@shared/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];
      if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
      }
      if (process.env.CORS_ALLOWED_ORIGINS) {
        const additional = process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim());
        allowedOrigins.push(...additional);
      }

      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.railway.app')) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global middleware
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('DentalMarket API')
    .setDescription('Dental equipment marketplace API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`DentalMarket API running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}
bootstrap();
