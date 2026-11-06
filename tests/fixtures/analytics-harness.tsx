import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { usePathname } from "next/navigation";
import { AnalyticsProvider, CommerceView, PurchaseEvent } from "../../src/components/analytics/analytics-provider";
import { CartView } from "../../src/components/cart/cart-view";
import { commerce } from "../../src/lib/analytics/contracts";
const first = "00000000-0000-4000-a000-000000000001";
const second = "00000000-0000-4000-a000-000000000002";
function Harness() {
  const pathname = usePathname(), [, render] = useState(0);
  const id = pathname.endsWith("second") ? second : first;
  const item = { productId: first, slug: "fixture", name: "Producto simulado", imagePath: "/fixture.svg", imageAlt: "Fixture", unitPriceClp: 8990, quantity: 2, subtotalClp: 17980, availableStock: 50, active: true, available: true, warning: null };
  const cart = { version: 1, items: [item], totalClp: 17980, currency: "CLP" as const };
  function navigate(route: string) { history.pushState({}, "", route); window.dispatchEvent(new PopStateEvent("popstate")); }
  return <>
    <button onClick={() => render(n => n + 1)}>Render adicional</button>
    {["/catalogo", "/catalogo?q=fixture", "/catalogo?q=second", "/productos/first", "/productos/second", "/checkout", "/carrito", "/invitado", "/pedido-simulado"].map(route => <button key={route} onClick={() => navigate(route)}>{route}</button>)}
    {pathname === "/pedido-simulado" && <PurchaseEvent orderId={second} />}
    {pathname.startsWith("/productos/") && <CommerceView name="view_item" eventKey={id + ":8990"} value={commerce([{ productId: id, unitPriceClp: 8990, quantity: 1 }])} />}
    {pathname === "/checkout" && <CommerceView name="begin_checkout" eventKey="same-cart" value={commerce([{ productId: first, unitPriceClp: 8990, quantity: 2 }])} />}
    {["/carrito", "/invitado"].includes(pathname) && <CartView key={pathname} initialCart={cart} guest={pathname === "/invitado"} />}
  </>;
}
const config = { enabled: true, measurementId: "G-TEST12345", debug: new URLSearchParams(location.search).get("debug") === "true", vitals: false, environment: "local", experimentId: "fixture", traffic: "human" as const, origin: location.origin };
createRoot(document.getElementById("root")!).render(<StrictMode><AnalyticsProvider config={config}><Harness /></AnalyticsProvider></StrictMode>);
