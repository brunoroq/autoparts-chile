import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link className="footer-brand" href="/">
            AUTO<span>PARTS</span> CHILE<span className="red">.</span>
          </Link>
          <p>Pequeños detalles. Grandes caminos.</p>
        </div>
        <div>
          <h2>Explora</h2>
          <Link href="/">Inicio</Link>
          <Link href="/catalogo">Todos los accesorios</Link>
        </div>
        <div className="footer-project">
          <h2>Un proyecto para aprender</h2>
          <p>
            Tienda de demostración de INFB8091.
            <br />
            Productos, precios y stock ficticios.
            <br />
            Compras de prueba, sin dinero real.
          </p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 AutoParts Chile · Proyecto académico</span>
        <span>Desempeño de Sistemas</span>
      </div>
    </footer>
  );
}
