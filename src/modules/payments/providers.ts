import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk";
import { ApiError } from "../../lib/http/errors";

export const scenarios = [
  "approved",
  "rejected",
  "cancelled",
  "timeout",
  "timeout-approved",
  "reversal-failed",
  "reversal-timeout",
] as const;
export type Scenario = (typeof scenarios)[number];
export type Evidence = {
  state: string;
  amount: number;
  buyOrder: string;
  sessionId: string;
  code?: number;
  balance?: number;
};
export type PaymentInput = {
  amountClp: number;
  externalReference: string | null;
  sessionId: string | null;
  tokenCipher: string | null;
  simulatedOutcome: string | null;
};
export interface PaymentGateway {
  create(input: PaymentInput): Promise<{ token: string; url: string }>;
  commit(input: PaymentInput): Promise<Evidence>;
  status(input: PaymentInput): Promise<Evidence>;
  refund(input: PaymentInput): Promise<string>;
}
export function paymentProvider() {
  const mode = process.env.PAYMENT_PROVIDER || "simulated";
  if (process.env.VERCEL === "1" && mode !== "simulated")
    throw new ApiError(
      "Esta publicación admite exclusivamente pagos simulados.",
      503,
      "PAYMENT_CONFIGURATION",
    );
  if (
    !["simulated", "webpay_integration"].includes(mode) ||
    (process.env.WEBPAY_ENVIRONMENT &&
      process.env.WEBPAY_ENVIRONMENT !== "integration")
  )
    throw new ApiError(
      "Configuración de pagos inválida: solo se permite integración.",
      503,
      "PAYMENT_CONFIGURATION",
    );
  if (mode === "webpay_integration") tokenKey();
  return mode === "simulated"
    ? ("SIMULATED" as const)
    : ("WEBPAY_INTEGRATION" as const);
}
function tokenKey() {
  const secret = process.env.PAYMENT_TOKEN_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret))
    throw new ApiError(
      "Falta configurar la protección de tokens de integración.",
      503,
      "PAYMENT_CONFIGURATION",
    );
  return Buffer.from(secret, "hex");
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function encryptToken(token: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function decryptToken(value: string | null) {
  if (!value) throw new Error("Token no disponible");
  const data = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      tokenKey(),
      data.subarray(0, 12),
    );
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
function simulatedEvidence(input: PaymentInput): Evidence {
  const outcome = input.simulatedOutcome;
  return {
    state:
      outcome === "rejected"
        ? "FAILED"
        : outcome === "cancelled"
          ? "ABORTED"
          : outcome === "timeout"
            ? "INITIALIZED"
            : "AUTHORIZED",
    amount: input.amountClp,
    buyOrder: input.externalReference!,
    sessionId: input.sessionId!,
    code: outcome === "rejected" ? -1 : 0,
  };
}
export const simulatedGateway: PaymentGateway = {
  async create() {
    throw new Error("No se necesita token simulado");
  },
  async commit(input) {
    if (input.simulatedOutcome?.startsWith("timeout"))
      throw new Error("Resultado indeterminado simulado");
    return simulatedEvidence(input);
  },
  async status(input) {
    return simulatedEvidence(input);
  },
  async refund(input) {
    if (input.simulatedOutcome === "reversal-timeout")
      throw new Error("Reversa indeterminada simulada");
    return input.simulatedOutcome === "reversal-failed"
      ? "UNCONFIRMED"
      : "REVERSED";
  },
};
type WebpayTransport = {
  create(
    buyOrder: string,
    sessionId: string,
    amount: number,
    returnUrl: string,
  ): Promise<unknown>;
  commit(token: string): Promise<unknown>;
  status(token: string): Promise<unknown>;
  refund(token: string, amount: number): Promise<unknown>;
};
export function webpayGateway(transport?: WebpayTransport): PaymentGateway {
  if (process.env.VERCEL === "1")
    throw new ApiError(
      "Webpay no está habilitado en esta publicación.",
      503,
      "PAYMENT_CONFIGURATION",
    );
  paymentProvider();
  // Credenciales públicas oficiales de prueba; no existe configuración de producción.
  const transaction =
    transport ??
    new WebpayPlus.Transaction(
      new Options(
        IntegrationCommerceCodes.WEBPAY_PLUS,
        IntegrationApiKeys.WEBPAY,
        Environment.Integration,
        10000,
      ),
    );
  function evidence(raw: unknown): Evidence {
    if (!raw || typeof raw !== "object")
      throw new Error("Respuesta de proveedor inválida");
    const r = raw as Record<string, unknown>;
    return {
      state: String(r.status),
      amount: Number(r.amount),
      buyOrder: String(r.buy_order),
      sessionId: String(r.session_id),
      code: typeof r.response_code === "number" ? r.response_code : undefined,
      balance: typeof r.balance === "number" ? r.balance : undefined,
    };
  }
  return {
    async create(input) {
      const base = new URL(process.env.NEXTAUTH_URL!);
      const raw: unknown = await transaction.create(
        input.externalReference!,
        input.sessionId!,
        input.amountClp,
        new URL("/api/v1/payments/webpay/return", base).href,
      );
      const r = raw as Record<string, unknown>;
      if (
        typeof r.token !== "string" ||
        !/^[a-z0-9]{20,128}$/i.test(r.token) ||
        typeof r.url !== "string" ||
        new URL(r.url).origin !== "https://webpay3gint.transbank.cl"
      )
        throw new Error("Redirección de integración inválida");
      return { token: r.token, url: r.url };
    },
    async commit(input) {
      return evidence(
        await transaction.commit(decryptToken(input.tokenCipher)),
      );
    },
    async status(input) {
      return evidence(
        await transaction.status(decryptToken(input.tokenCipher)),
      );
    },
    async refund(input) {
      const raw: unknown = await transaction.refund(
        decryptToken(input.tokenCipher),
        input.amountClp,
      );
      const r = raw as Record<string, unknown>;
      if (r.type === "REVERSED") return "REVERSED";
      if (
        r.type === "NULLIFIED" &&
        r.response_code === 0 &&
        r.nullified_amount === input.amountClp &&
        r.balance === 0
      )
        return "NULLIFIED";
      return "UNCONFIRMED";
    },
  };
}
