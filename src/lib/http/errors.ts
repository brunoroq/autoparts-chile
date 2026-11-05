export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_REQUEST",
    public retryAfter?: number,
  ) {
    super(message);
  }
}
