/**
 * Standardized API error + response helpers.
 * Response shape (always):
 *   { msg, message, code?, errors?, retryAfter? }
 * Frontend already accepts msg || message.
 */

export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ code?: string, errors?: Array<{ field: string, message: string }>, retryAfter?: number }} [extras]
   */
  constructor(statusCode, message, extras = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = extras.code;
    this.errors = extras.errors;
    this.retryAfter = extras.retryAfter;
  }
}

/**
 * Build a consistent error JSON body.
 * @param {string} message
 * @param {{ code?: string, errors?: unknown, retryAfter?: number }} [extras]
 */
export const buildErrorBody = (message, extras = {}) => {
  const body = {
    msg: message,
    message,
  };

  if (extras.code) body.code = extras.code;
  if (extras.errors) body.errors = extras.errors;
  if (extras.retryAfter != null) body.retryAfter = extras.retryAfter;

  return body;
};

/**
 * Send a standardized error response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {{ code?: string, errors?: unknown, retryAfter?: number }} [extras]
 */
export const sendError = (res, statusCode, message, extras = {}) => {
  if (extras.retryAfter != null) {
    res.set("Retry-After", String(extras.retryAfter));
  }
  return res.status(statusCode).json(buildErrorBody(message, extras));
};

/**
 * Map an Error / ApiError into a status + body without sending.
 * @param {Error & { statusCode?: number, status?: number, code?: string, errors?: unknown, retryAfter?: number, type?: string }} err
 */
export const normalizeError = (err) => {
  if (err instanceof ApiError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code,
      errors: err.errors,
      retryAfter: err.retryAfter,
    };
  }

  // express.json / body-parser payload too large
  if (err?.type === "entity.too.large" || err?.status === 413 || err?.statusCode === 413) {
    return {
      statusCode: 413,
      message: "Request payload too large",
      code: "PAYLOAD_TOO_LARGE",
    };
  }

  // Multer upload limits
  if (err?.code === "LIMIT_FILE_SIZE") {
    return {
      statusCode: 413,
      message: "Uploaded file is too large",
      code: "FILE_TOO_LARGE",
    };
  }
  if (err?.code === "LIMIT_UNEXPECTED_FILE" || err?.code === "LIMIT_FILE_COUNT") {
    return {
      statusCode: 400,
      message: "Invalid file upload",
      code: "INVALID_UPLOAD",
    };
  }

  // Malformed JSON
  if (err instanceof SyntaxError && "body" in err) {
    return {
      statusCode: 400,
      message: "Invalid JSON payload",
      code: "INVALID_JSON",
    };
  }

  const statusCode = err.statusCode || err.status || 500;
  return {
    statusCode,
    message: err.message || "An unexpected server error occurred",
    code: err.code || (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
  };
};
