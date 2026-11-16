// Estado desechable: nunca conecta a PostgreSQL ni contiene datos del sandbox.
export const token = "a".repeat(64);
export const state = {
  stock: 5, cartItems: 1, commits: 0, statuses: 0, refunds: 0,
  payment: {
    id: "payment-fixture", orderId: "order-fixture", provider: "WEBPAY_INTEGRATION",
    status: "PENDING", amountClp: 24990, externalReference: "AP" + "b".repeat(24),
    sessionId: "c".repeat(48), tokenCipher: "", operation: null as string | null,
    operationAt: null as Date | null, simulatedOutcome: null, providerState: "INITIALIZED",
  },
  order: {
    id: "order-fixture", userId: "user-fixture", status: "PENDING", totalClp: 24990,
    createdAt: new Date("2026-11-15T00:00:00Z"), cartId: "cart-fixture", cartVersion: 0,
    items: [{ id: "item-fixture", productId: "product-fixture", productName: "Producto de prueba", unitPriceClp: 24990, quantity: 1 }],
  },
};
const orderView = () => structuredClone({ ...state.order, payments: [state.payment] });
type Mutation = { where: Record<string, unknown>; data: Record<string, unknown> };
export const prisma = {
  paymentAttempt: {
    async findUnique({ where }: { where: { tokenHash: string } }) {
      const { createHash } = await import("node:crypto");
      return where.tokenHash === createHash("sha256").update(token).digest("hex") ? structuredClone(state.payment) : null;
    },
    async findFirst() { return structuredClone({ ...state.payment, order: orderView() }); },
    async findUniqueOrThrow() { return structuredClone(state.payment); },
    async updateMany({ where, data }: Mutation) {
      if (where.status !== state.payment.status || where.operation !== state.payment.operation || where.operationAt !== state.payment.operationAt) return { count: 0 };
      Object.assign(state.payment, data);
      return { count: 1 };
    },
    async update({ data }: Mutation) { Object.assign(state.payment, data); },
  },
  order: {
    async findFirst() { return orderView(); },
    async findUniqueOrThrow() { return orderView(); },
    async update({ data }: Mutation) { Object.assign(state.order, data); },
  },
  product: {
    async updateMany({ data }: Mutation) {
      state.stock -= (data.stock as { decrement: number }).decrement;
      return { count: 1 };
    },
  },
  cart: { async updateMany() { return { count: 1 }; } },
  cartItem: { async deleteMany() { state.cartItems = 0; } },
  async $queryRaw() { return []; },
  async $transaction(operation: (client: unknown) => Promise<void>) { return operation(prisma); },
};

// Doble del SDK: respuesta de integración determinista, sin transporte de red.
export const Environment = { Integration: "integration" };
export const IntegrationApiKeys = { WEBPAY: "fixture-only" };
export const IntegrationCommerceCodes = { WEBPAY_PLUS: "fixture-only" };
export class Options {}
export const WebpayPlus = {
  Transaction: class {
    async commit() {
      state.commits++;
      return { status: "AUTHORIZED", response_code: 0, amount: 24990, buy_order: state.payment.externalReference, session_id: state.payment.sessionId };
    }
    async status() { state.statuses++; throw new Error("Consulta inesperada al proveedor simulado"); }
    async refund() { state.refunds++; throw new Error("Reversa inesperada"); }
    async create() { throw new Error("No se permite crear transacciones"); }
  },
};
