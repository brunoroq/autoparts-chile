import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { WebVitals } from "@/components/analytics/web-vitals";
import { analyticsConfig } from "@/lib/observability/config";
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: {
    default: "AutoParts Chile | Accesorios para tu camino",
    template: "%s | AutoParts Chile",
  },
  description:
    "Explora iluminación, electrónica, limpieza, herramientas y accesorios para tu auto. Catálogo académico en pesos chilenos.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL">
      <body>
        <AnalyticsProvider config={analyticsConfig()}>
          <WebVitals />
          <SiteHeader />
          <main id="contenido" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
