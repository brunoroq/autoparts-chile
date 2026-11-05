import { createHash } from "node:crypto";
import { ApiError } from "../http/errors";

export class AttemptLimiter {
  private entries = new Map<string, { count: number; expires: number }>();
  constructor(
    private maxEntries = 5000,
    private now = () => Date.now(),
  ) {}
  take(key: string, limit: number, windowMs = 15 * 60 * 1000) {
    const now = this.now();
    for (const [id, value] of this.entries)
      if (value.expires <= now) this.entries.delete(id);
    const entry = this.entries.get(key);
    if (entry && entry.count >= limit)
      throw new ApiError(
        "Demasiados intentos. Vuelve a intentar más tarde.",
        429,
        "RATE_LIMITED",
        Math.max(1, Math.ceil((entry.expires - now) / 1000)),
      );
    if (!entry && this.entries.size >= this.maxEntries)
      throw new ApiError(
        "Intenta nuevamente más tarde.",
        429,
        "RATE_LIMITED",
        60,
      );
    this.entries.set(key, {
      count: (entry?.count ?? 0) + 1,
      expires: entry?.expires ?? now + windowMs,
    });
  }
}
const limiter = new AttemptLimiter();
export function limitAttempt(kind: "login" | "register", email: string) {
  limiter.take(`${kind}:global`, kind === "login" ? 100 : 30);
  const fingerprint = createHash("sha256")
    .update(`${process.env.NEXTAUTH_SECRET}:${email.trim().toLowerCase()}`)
    .digest("hex");
  limiter.take(`${kind}:${fingerprint}`, 10);
}
