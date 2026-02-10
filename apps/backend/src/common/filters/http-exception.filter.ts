import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HTTP Exception Filter
 * Catches all HTTP exceptions and formats them consistently
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.getErrorMessage(exceptionResponse),
      error: typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as any).error,
      details: typeof exceptionResponse === 'object' ? (exceptionResponse as any).message : undefined,
    });

    // Log error for monitoring
    this.logger.error(
      `HTTP ${status} Error: ${request.method} ${request.url}`,
      exception.stack,
    );
  }

  /**
   * Extract error message from exception response
   */
  private getErrorMessage(exceptionResponse: any): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (exceptionResponse.message) {
      return exceptionResponse.message;
    }

    return 'An error occurred';
  }
}
