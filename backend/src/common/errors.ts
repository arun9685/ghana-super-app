// A small typed error hierarchy so the error-handling middleware (spec §37)
// can map every failure to the right HTTP status and a stable machine-
// readable code, instead of leaking stack traces or guessing status codes.

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Invalid request", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to perform this action") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Conflicting state") {
    super(409, "CONFLICT", message);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = "Too many requests — please try again later") {
    super(429, "RATE_LIMITED", message);
  }
}
