export const MIN_PASSWORD_LENGTH = 8;

/**
 * @param {unknown} password
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validatePassword(password) {
  if (password == null || String(password).trim() === "") {
    return { ok: false, message: "Password is required" };
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  return { ok: true };
}
