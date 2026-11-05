"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function AuthForm({
  register = false,
  callbackUrl,
  registered = false,
}: {
  register?: boolean;
  callbackUrl: string;
  registered?: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <div className="auth-panel">
      <p className="eyebrow red">TU PRÓXIMO CAMINO</p>
      <h1>{register ? "Crea tu cuenta." : "Bienvenido de vuelta."}</h1>
      <p className="auth-intro">
        {register
          ? "Guarda tus accesorios favoritos en un carrito personal."
          : "Inicia sesión para continuar con tu carrito."}
      </p>
      {registered && (
        <p className="form-notice" role="status">
          Cuenta creada. Ya puedes iniciar sesión.
        </p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setPending(true);
          const data = new FormData(event.currentTarget);
          try {
            if (register) {
              const response = await fetch("/api/v1/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(data)),
              });
              const result = await response.json();
              if (!response.ok) {
                setError(
                  result.error?.message ?? "No pudimos crear la cuenta.",
                );
                return;
              }
              router.push(
                `/iniciar-sesion?registrado=1&callbackUrl=${encodeURIComponent(callbackUrl)}`,
              );
            } else {
              const result = await signIn("credentials", {
                email: data.get("email"),
                password: data.get("password"),
                callbackUrl,
                redirect: false,
              });
              if (!result?.ok || result.error) {
                setError(
                  result?.error === "RateLimited"
                    ? "Demasiados intentos. Vuelve a intentar más tarde."
                    : "No pudimos iniciar sesión. Revisa tus datos o intenta más tarde.",
                );
                return;
              }
              router.push(callbackUrl);
              router.refresh();
            }
          } catch {
            setError("No pudimos conectar. Intenta nuevamente.");
          } finally {
            setPending(false);
          }
        }}
      >
        {register && (
          <label htmlFor="auth-name">
            Nombre
            <input
              id="auth-name"
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
            />
          </label>
        )}
        <label htmlFor="auth-email">
          Correo electrónico
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <label htmlFor="auth-password">
          Contraseña
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={12}
            maxLength={128}
            required
            aria-describedby={register ? "password-help" : undefined}
          />
        </label>
        {register && (
          <>
            <p id="password-help" className="form-help">
              Entre 12 y 128 caracteres. Puedes usar espacios y símbolos.
            </p>
            <label htmlFor="auth-confirm">
              Confirmar contraseña
              <input
                id="auth-confirm"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-red" disabled={pending}>
          {pending
            ? "Un momento…"
            : register
              ? "Crear cuenta"
              : "Iniciar sesión"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="auth-switch">
        {register ? "¿Ya tienes cuenta? " : "¿Primera vez por aquí? "}
        <Link
          href={`${register ? "/iniciar-sesion" : "/registro"}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        >
          {register ? "Inicia sesión" : "Crea tu cuenta"}
        </Link>
      </p>
    </div>
  );
}
