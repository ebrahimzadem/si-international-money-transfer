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
 * All Exceptions Filter
 * Catches ALL exceptions (including non-HTTP errors)
 * Provides consistent error response format
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'INTERNAL_SERVER_ERROR';

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      }
    }
    // Handle PostgreSQL errors
    else if (exception instanceof Error && 'code' in exception) {
      const pgError = exception as any;

      switch (pgError.code) {
        case '23505': // Unique constraint violation
          status = HttpStatus.CONFLICT;
          message = 'Resource already exists';
          error = 'DUPLICATE_ENTRY';
          break;
        case '23503': // Foreign key violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Referenced resource does not exist';
          error = 'FOREIGN_KEY_VIOLATION';
          break;
        case '23502': // Not null violation
          status = HttpStatus.BAD_REQUEST;
          message = 'Required field is missing';
          error = 'MISSING_REQUIRED_FIELD';
          break;
        default:
          message = 'Database error occurred';
          error = 'DATABASE_ERROR';
      }
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      message = exception.message || message;

      // Specific blockchain errors
      if (message.includes('insufficient funds')) {
        status = HttpStatus.BAD_REQUEST;
        error = 'INSUFFICIENT_FUNDS';
      } else if (message.includes('invalid address')) {
        status = HttpStatus.BAD_REQUEST;
        error = 'INVALID_ADDRESS';
      } else if (message.includes('gas')) {
        status = HttpStatus.BAD_REQUEST;
        error = 'GAS_ERROR';
      } else if (message.includes('nonce')) {
        status = HttpStatus.CONFLICT;
        error = 'NONCE_ERROR';
      }
    }

    // Format error response
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
    };

    // Log error for monitoring
    this.logger.error(
      `${request.method} ${request.url} - Status ${status}: ${message}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    // Send error response
    response.status(status).json(errorResponse);
  }
}
