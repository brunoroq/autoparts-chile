import { ApiError } from "../../lib/http/errors";
import { exactFields } from "../../lib/http/input";
import { validPassword } from "../../lib/auth/password";

export function normalizeEmail(email: unknown) {
  if (typeof email !== "string")
    throw new ApiError("Revisa el correo electrónico.");
  const value = email.trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new ApiError("Revisa el correo electrónico.");
  return value;
}
export function registrationInput(body: Record<string, unknown>) {
  exactFields(body, ["name", "email", "password", "confirmPassword"]);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120)
    throw new ApiError("El nombre debe tener entre 2 y 120 caracteres.");
  const email = normalizeEmail(body.email);
  if (!validPassword(body.password))
    throw new ApiError("La contraseña debe tener entre 12 y 128 caracteres.");
  if (body.password !== body.confirmPassword)
    throw new ApiError("Las contraseñas no coinciden.");
  return { name, email, password: body.password };
}
