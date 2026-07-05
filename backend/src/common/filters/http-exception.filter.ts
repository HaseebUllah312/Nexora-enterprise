import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    this.logger.error(`${request.method} ${request.url} -> ${status}`);
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(exception);
      try {
        const fs = require('fs');
        const path = require('path');
        const logDir = path.join(process.env.APPDATA || '', 'nexora-enterprise-desktop');
        if (fs.existsSync(logDir)) {
          const logPath = path.join(logDir, 'error.log');
          const errorMsg = `[${new Date().toISOString()}] ${request.method} ${request.url}\n${exception instanceof Error ? exception.stack : JSON.stringify(exception)}\n\n`;
          fs.appendFileSync(logPath, errorMsg, 'utf8');
        }
      } catch (err) {
        // ignore log write errors
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
