import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container section empty-state">
      <p className="eyebrow red">404 · FUERA DE RUTA</p>
      <h1>Este camino no lleva a un producto.</h1>
      <p>El accesorio no existe o ya no está disponible.</p>
      <Link className="button button-red" href="/catalogo">
        Explorar el catálogo →
      </Link>
    </section>
  );
}
