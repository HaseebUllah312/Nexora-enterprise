import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { BranchScopeInterceptor } from './common/interceptors/branch-scope.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // allow extra fields — branchId gets injected
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new BranchScopeInterceptor());
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`FactoryERP Pro API → http://localhost:${port}/api/v1`);
}
bootstrap();
