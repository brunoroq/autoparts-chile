import { prisma } from "../../lib/db/prisma";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { hashPassword, verifyPassword } from "../../lib/auth/password";
import { ApiError } from "../../lib/http/errors";
import { measure } from "../../lib/observability/request";
import { normalizeEmail, registrationInput } from "./validation";

export async function registerUser(
  body: Record<string, unknown>,
  client: PrismaClient = prisma,
) {
  const input = registrationInput(body);
  const passwordHash = await hashPassword(input.password);
  try {
    return await measure("db", () =>
      client.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          cart: { create: {} },
        },
        select: { id: true, name: true, email: true },
      }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(
        "No fue posible registrar este correo. Usa otro o inicia sesión.",
        409,
        "ACCOUNT_EXISTS",
      );
    throw error;
  }
}

export async function authenticateUser(
  emailInput: unknown,
  password: unknown,
  client: PrismaClient = prisma,
) {
  let email: string;
  try {
    email = normalizeEmail(emailInput);
  } catch {
    return null;
  }
  if (typeof password !== "string") return null;
  const user = await measure("db", () =>
    client.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true },
    }),
  );
  if (!(await verifyPassword(password, user?.passwordHash))) return null;
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}
