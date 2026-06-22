import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { captureException } from '../telemetry.js';

export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code?: string, public readonly details?: unknown) {
    super(message); this.name = 'AppError';
  }
}

export class NotFoundError extends AppError { constructor(resource: string, id?: string) { super(404, `${resource}${id ? ` with id "${id}"` : ''} not found`, 'NOT_FOUND'); } }
export class UnauthorizedError extends AppError { constructor(message = 'Unauthorized') { super(401, message, 'UNAUTHORIZED'); } }
export class ForbiddenError extends AppError { constructor(message = 'Forbidden') { super(403, message, 'FORBIDDEN'); } }
export class ValidationError extends AppError { constructor(details: unknown) { super(422, 'Validation failed', 'VALIDATION_ERROR', details); } }
export class ConflictError extends AppError { constructor(message: string) { super(409, message, 'CONFLICT'); } }

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  request.log.error({ err: error, url: request.url }, 'Request error');
  if (error instanceof ZodError) return reply.status(422).send({ statusCode: 422, code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.issues });
  if (error instanceof AppError) return reply.status(error.statusCode).send({ statusCode: error.statusCode, code: error.code, message: error.message, details: error.details });
  if (error.statusCode === 429) return reply.status(429).send({ statusCode: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' });
  if (error.statusCode === 401 || error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') return reply.status(401).send({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Authorization required' });
  if (error.validation) return reply.status(400).send({ statusCode: 400, code: 'BAD_REQUEST', message: 'Invalid request data', details: error.validation });
  if (process.env['NODE_ENV'] === 'production') captureException(error as unknown as Error, { url: request.url, method: request.method });
  return reply.status(500).send({ statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' });
}
