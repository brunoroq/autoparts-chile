const paths: Record<string, React.ReactNode> = {
  iluminacion: (
    <path d="M9 16h6M9 19h6M10 22h4M8 13c-5-6-1-11 4-11s9 5 4 11l-1 3H9Z" />
  ),
  electronica: (
    <>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="m13 7-4 6h5l-3 5M9 1v3M15 1v3M9 20v3M15 20v3" />
    </>
  ),
  limpieza: (
    <path d="M8 8h8v13H8ZM10 8V4h5l3 3M11 4V2h6M5 11l-2-2M4 16H1M19 11l2-2M20 16h3" />
  ),
  herramientas: (
    <path d="m14 6 4-4a6 6 0 0 1-7 8l-8 8a2 2 0 0 0 3 3l8-8a6 6 0 0 0 8-7l-4 4Z" />
  ),
  seguridad: <path d="m12 2 9 4v6c0 5-6 8-9 10-3-2-9-5-9-10V6ZM8 12l3 3 5-6" />,
  "accesorios-interiores": (
    <path d="M6 3h7v8l5 5v5H4v-8h9M8 11V3M18 16h3v5M3 21h19" />
  ),
};
export function CategoryIcon({ slug }: { slug: string }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[slug] ?? paths.herramientas}
    </svg>
  );
}
