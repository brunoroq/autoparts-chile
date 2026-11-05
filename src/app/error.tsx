"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container section empty-state" role="alert">
      <p className="eyebrow red">HAGAMOS UNA PAUSA</p>
      <h1>No pudimos cargar el catálogo.</h1>
      <p>
        Puede haber un problema de conexión. Intenta nuevamente en unos
        momentos.
      </p>
      <button className="button button-red" onClick={reset}>
        Intentar nuevamente
      </button>
      <Link className="text-link" href="/">
        Volver al inicio
      </Link>
    </section>
  );
}
