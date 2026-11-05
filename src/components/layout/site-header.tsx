import Link from "next/link";
import { currentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="topbar">
        <div className="container">
          <span>ACCESORIOS PARA TU PRÓXIMO CAMINO</span>
          <span>Proyecto académico · Chile</span>
        </div>
      </div>
      <header className="site-header container">
        <Link href="/" className="brand" aria-label="AutoParts Chile, inicio">
          <span className="brand-mark" aria-hidden="true">
            {"//"}
          </span>
          <span>
            AUTO<span className="brand-light">PARTS</span>
            <small>CHILE</small>
          </span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link href="/">Inicio</Link>
          <Link href="/catalogo">
            Catálogo <span aria-hidden="true">↗</span>
          </Link>
        </nav>
        <div className="account-links">
          <Link href="/carrito">Carrito</Link>
          {user ? (
            <>
              <Link href="/pedidos">Pedidos</Link>
              <span className="sr-only">Sesión iniciada</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/iniciar-sesion">Ingresar</Link>
          )}
        </div>
        <form action="/catalogo" className="header-search" role="search">
          <label htmlFor="header-q" className="sr-only">
            Buscar accesorios
          </label>
          <input
            id="header-q"
            name="q"
            type="search"
            placeholder="¿Qué necesita tu auto?"
            maxLength={100}
          />
          <button type="submit" aria-label="Buscar">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
          </button>
        </form>
      </header>
    </>
  );
}
