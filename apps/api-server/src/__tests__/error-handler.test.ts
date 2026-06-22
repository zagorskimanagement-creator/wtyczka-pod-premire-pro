import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError } from '../middleware/error-handler.js';

describe('Error Classes', () => {
  it('AppError creates with correct properties', () => { const err = new AppError(400, 'Bad request', 'BAD_REQUEST', { field: 'email' }); expect(err.statusCode).toBe(400); expect(err.message).toBe('Bad request'); expect(err.code).toBe('BAD_REQUEST'); expect(err.details).toEqual({ field: 'email' }); expect(err.name).toBe('AppError'); });
  it('NotFoundError creates with correct status', () => { const err = new NotFoundError('User', 'abc123'); expect(err.statusCode).toBe(404); expect(err.code).toBe('NOT_FOUND'); expect(err.message).toContain('User'); expect(err.message).toContain('abc123'); });
  it('UnauthorizedError has 401 status', () => { const err = new UnauthorizedError(); expect(err.statusCode).toBe(401); expect(err.code).toBe('UNAUTHORIZED'); });
  it('ForbiddenError has 403 status', () => { const err = new ForbiddenError(); expect(err.statusCode).toBe(403); expect(err.code).toBe('FORBIDDEN'); });
  it('ValidationError has 422 status', () => { const err = new ValidationError([{ field: 'email', message: 'Invalid' }]); expect(err.statusCode).toBe(422); expect(err.code).toBe('VALIDATION_ERROR'); });
  it('ConflictError has 409 status', () => { const err = new ConflictError('Resource already exists'); expect(err.statusCode).toBe(409); expect(err.code).toBe('CONFLICT'); });
});
