import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Validation Exception Filter
 * Catches validation errors from class-validator
 * Formats validation errors in a user-friendly way
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    // Check if this is a validation error
    const isValidationError =
      exceptionResponse.message &&
      Array.isArray(exceptionResponse.message);

    // Format validation errors
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      validationErrors: isValidationError
        ? this.formatValidationErrors(exceptionResponse.message)
        : exceptionResponse.message,
    };

    // Log validation error
    this.logger.warn(
      `Validation Error: ${request.method} ${request.url}`,
      JSON.stringify(errorResponse.validationErrors),
    );

    response.status(status).json(errorResponse);
  }

  /**
   * Format validation errors into a more readable structure
   */
  private formatValidationErrors(errors: any[]): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    errors.forEach((error) => {
      // Handle string errors
      if (typeof error === 'string') {
        if (!formatted['general']) {
          formatted['general'] = [];
        }
        formatted['general'].push(error);
      }
      // Handle ValidationError objects
      else if (typeof error === 'object' && error.constraints) {
        const field = error.property || 'unknown';
        formatted[field] = Object.values(error.constraints);
      }
    });

    return formatted;
  }
}
