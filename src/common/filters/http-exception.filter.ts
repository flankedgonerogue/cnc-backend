import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlContextType, GqlExceptionFilter } from '@nestjs/graphql';
import { Prisma } from '../../generated/prisma/client';
import { Request, Response } from 'express';

type PrismaKnownError = Prisma.PrismaClientKnownRequestError;

@Catch()
export class HttpExceptionFilter
  implements ExceptionFilter, GqlExceptionFilter
{
  catch(exception: unknown, host: ArgumentsHost) {
    Logger.debug(exception);

    // If it's a GraphQL request, NestJS handles the GraphQL-formatted errors natively.
    // We just return the exception to let the GraphQL module process it.
    if (host.getType<GqlContextType>() === 'graphql') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();
      const normalizedError =
        typeof responseBody === 'string'
          ? responseBody
          : ((responseBody as { message?: string | string[] }).message ??
            responseBody);

      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        error: normalizedError,
      });
      return;
    }

    if (this.isPrismaKnownError(exception)) {
      const mapped = this.mapPrismaError(exception);
      response.status(mapped.statusCode).json({
        statusCode: mapped.statusCode,
        timestamp: new Date().toISOString(),
        path: request.url,
        error: mapped.message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: 'Internal server error',
    });
  }

  private isPrismaKnownError(
    exception: unknown,
  ): exception is PrismaKnownError {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as PrismaKnownError).code === 'string'
    );
  }

  private mapPrismaError(error: PrismaKnownError): {
    statusCode: number;
    message: string;
  } {
    switch (error.code) {
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
        };
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Unique constraint failed',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid relation reference',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Database error',
        };
    }
  }
}
