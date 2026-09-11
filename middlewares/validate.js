import { sendError } from "../utils/apiError.js";
import { MIN_PASSWORD_LENGTH } from "../utils/passwordValidation.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const RESET_TOKEN_RE = /^[a-fA-F0-9]{64}$/;

/**
 * @typedef {{
 *   type?: 'string' | 'number' | 'boolean' | 'array' | 'object',
 *   required?: boolean,
 *   email?: boolean,
 *   minLength?: number,
 *   maxLength?: number,
 *   min?: number,
 *   max?: number,
 *   enum?: string[],
 *   pattern?: RegExp,
 *   patternMessage?: string,
 *   trim?: boolean,
 *   lowercase?: boolean,
 *   optional?: boolean,
 * }} FieldRule
 */

/**
 * @param {unknown} value
 * @param {FieldRule} rule
 * @param {string} field
 * @returns {{ value?: unknown, error?: { field: string, message: string } }}
 */
const applyRule = (value, rule, field) => {
  const isMissing =
    value === undefined ||
    value === null ||
    (typeof value === "string" && rule.trim !== false && value.trim() === "");

  if (isMissing) {
    if (rule.required) {
      return { error: { field, message: `${field} is required` } };
    }
    return { value: undefined };
  }

  let next = value;

  if (rule.type === "string" || rule.email || rule.maxLength != null || rule.minLength != null) {
    if (typeof next !== "string") {
      return { error: { field, message: `${field} must be a string` } };
    }
    if (rule.trim !== false) next = next.trim();
    if (rule.lowercase) next = next.toLowerCase();
  }

  if (rule.type === "number" && typeof next !== "number") {
    return { error: { field, message: `${field} must be a number` } };
  }

  if (rule.type === "boolean" && typeof next !== "boolean") {
    return { error: { field, message: `${field} must be a boolean` } };
  }

  if (rule.type === "array" && !Array.isArray(next)) {
    return { error: { field, message: `${field} must be an array` } };
  }

  if (rule.type === "object" && (typeof next !== "object" || next === null || Array.isArray(next))) {
    return { error: { field, message: `${field} must be an object` } };
  }

  if (typeof next === "string") {
    if (rule.minLength != null && next.length < rule.minLength) {
      return {
        error: {
          field,
          message: `${field} must be at least ${rule.minLength} characters`,
        },
      };
    }
    if (rule.maxLength != null && next.length > rule.maxLength) {
      return {
        error: {
          field,
          message: `${field} must be at most ${rule.maxLength} characters`,
        },
      };
    }
    if (rule.email && !EMAIL_RE.test(next)) {
      return { error: { field, message: `${field} must be a valid email` } };
    }
    if (rule.pattern && !rule.pattern.test(next)) {
      return {
        error: {
          field,
          message: rule.patternMessage || `${field} has an invalid format`,
        },
      };
    }
    if (rule.enum && !rule.enum.includes(next)) {
      return {
        error: {
          field,
          message: `${field} must be one of: ${rule.enum.join(", ")}`,
        },
      };
    }
  }

  if (typeof next === "number") {
    if (rule.min != null && next < rule.min) {
      return { error: { field, message: `${field} must be at least ${rule.min}` } };
    }
    if (rule.max != null && next > rule.max) {
      return { error: { field, message: `${field} must be at most ${rule.max}` } };
    }
  }

  return { value: next };
};

/**
 * Validate req.body / params / query against a declarative schema.
 * Mutates the corresponding request property with sanitized values.
 *
 * @param {{
 *   body?: Record<string, FieldRule>,
 *   params?: Record<string, FieldRule>,
 *   query?: Record<string, FieldRule>,
 *   allowUnknownBody?: boolean,
 * }} schema
 */
export const validate = (schema) => (req, res, next) => {
  const errors = [];

  for (const source of /** @type {const} */ (["body", "params", "query"])) {
    const rules = schema[source];
    if (!rules) continue;

    const input = req[source] && typeof req[source] === "object" ? req[source] : {};
    const output = Array.isArray(input) ? [] : { ...input };

    for (const [field, rule] of Object.entries(rules)) {
      const result = applyRule(input[field], rule, field);
      if (result.error) {
        errors.push(result.error);
      } else if (result.value !== undefined) {
        output[field] = result.value;
      } else if (Object.prototype.hasOwnProperty.call(output, field) && result.value === undefined && !rule.required) {
        // leave optional missing fields unset
        delete output[field];
      }
    }

    if (source === "body" && schema.allowUnknownBody === false) {
      const allowed = new Set(Object.keys(rules));
      for (const key of Object.keys(output)) {
        if (!allowed.has(key)) {
          delete output[key];
        }
      }
    }

    req[source] = output;
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validation failed", {
      code: "VALIDATION_ERROR",
      errors,
    });
  }

  return next();
};

/** Shared field helpers */
export const fields = {
  email: {
    type: "string",
    required: true,
    email: true,
    maxLength: 254,
    lowercase: true,
  },
  password: {
    type: "string",
    required: true,
    minLength: MIN_PASSWORD_LENGTH,
    maxLength: 128,
    trim: false,
  },
  optionalString: (maxLength = 500) => ({
    type: "string",
    required: false,
    maxLength,
  }),
  objectId: {
    type: "string",
    required: true,
    pattern: OBJECT_ID_RE,
    patternMessage: "id must be a valid id",
  },
  resetToken: {
    type: "string",
    required: true,
    pattern: RESET_TOKEN_RE,
    patternMessage: "token must be a valid reset token",
  },
};

export const loginSchema = {
  body: {
    email: fields.email,
    password: {
      type: "string",
      required: true,
      minLength: 1,
      maxLength: 128,
      trim: false,
    },
  },
  allowUnknownBody: false,
};

export const forgotPasswordSchema = {
  body: {
    email: fields.email,
  },
  allowUnknownBody: false,
};

export const resetPasswordSchema = {
  params: {
    token: fields.resetToken,
  },
  body: {
    password: fields.password,
  },
  allowUnknownBody: false,
};

export const registerUserSchema = {
  body: {
    email: fields.email,
    password: fields.password,
    role: {
      type: "string",
      required: true,
      lowercase: true,
      enum: ["student", "trainer"],
    },
    name: fields.optionalString(120),
    phone: fields.optionalString(30),
    altPhone: fields.optionalString(30),
    address: fields.optionalString(500),
    dob: fields.optionalString(40),
    gender: fields.optionalString(40),
    education: fields.optionalString(120),
    university: fields.optionalString(120),
    profession: fields.optionalString(120),
    employmentStatus: fields.optionalString(80),
    experience: fields.optionalString(80),
    skills: fields.optionalString(1000),
    source: fields.optionalString(80),
    zenCourseName: fields.optionalString(200),
    zenCourseType: fields.optionalString(80),
  },
  allowUnknownBody: false,
};

export const changePasswordSchema = {
  body: {
    currentPassword: {
      type: "string",
      required: true,
      minLength: 1,
      maxLength: 128,
      trim: false,
    },
    newPassword: fields.password,
  },
  allowUnknownBody: false,
};

export const refreshSchema = {
  body: {
    refreshToken: {
      type: "string",
      required: false,
      maxLength: 2048,
      trim: false,
    },
  },
};
