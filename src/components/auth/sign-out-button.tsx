"use client";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <>
      <button
        type="button"
        className="account-signout"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            await signOut({ callbackUrl: "/" });
          } catch {
            setError(true);
            setPending(false);
          }
        }}
      >
        {pending ? "Saliendo…" : "Salir"}
      </button>
      {error && <span role="alert">Intenta salir nuevamente.</span>}
    </>
  );
}
