import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import { measure } from "../observability/request";

export async function currentUser() {
  const session = await measure("auth", () => getServerSession(authOptions));
  if (!session?.user?.id) return null;
  return measure("db", () =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    }),
  );
}
export async function requireUser() {
  const user = await currentUser();
  if (!user)
    throw new ApiError(
      "Inicia sesión para consultar tu carrito.",
      401,
      "UNAUTHENTICATED",
    );
  return user;
}
