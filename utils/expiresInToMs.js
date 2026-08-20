/**
 * Convert JWT-style expiresIn strings (e.g. "15m", "7d") to milliseconds.
 */
export const expiresInToMs = (expiresIn) => {
  if (typeof expiresIn === "number") return expiresIn * 1000;

  const value = String(expiresIn || "15m").trim();
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 15 * 60 * 1000;

  const amount = Number(match[1]);
  const unitMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }[match[2]];

  return amount * unitMs;
};
