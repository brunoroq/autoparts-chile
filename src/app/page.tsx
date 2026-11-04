export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-between px-6 py-10 sm:px-12 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <span className="text-xl font-bold tracking-tight">AutoParts<span className="text-orange-400"> Chile</span></span>
        <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs font-semibold text-orange-300">Proyecto universitario</span>
      </header>
      <section className="py-20 sm:py-28" aria-labelledby="welcome-title">
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-orange-400">INFB8091 · Desempeño de Sistemas</p>
        <h1 id="welcome-title" className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-7xl">El punto de partida para medir y mejorar.</h1>
        <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">Estamos preparando AutoParts Chile, una tienda de accesorios automotrices para estudiar el rendimiento bajo distintas condiciones de carga.</p>
        <div className="mt-10 border-l-2 border-orange-400 pl-5">
          <h2 className="font-semibold">Base técnica en preparación</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Esta página provisional comprueba el funcionamiento de Next.js. Las funciones de la tienda se incorporarán en las próximas etapas.</p>
        </div>
      </section>
      <footer className="border-t border-slate-800 pt-6 text-sm text-slate-500">AutoParts Chile · Desarrollo académico · 2026</footer>
    </main>
  );
}
