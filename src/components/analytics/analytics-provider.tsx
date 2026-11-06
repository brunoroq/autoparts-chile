"use client";
import Script from "next/script";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  analyticsContext,
  safeCommerce,
  type AnalyticsConfig,
  type Commerce,
  type CommerceEvent,
} from "@/lib/analytics/contracts";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}
type Analytics = {
  ready: boolean;
  config: AnalyticsConfig;
  track: (name: CommerceEvent, value: Commerce, key: string) => boolean;
};
const Context = createContext<Analytics | null>(null);
const consentKey = "autoparts:analytics-consent:v1";
function consent() {
  try {
    return localStorage.getItem(consentKey) || "unknown";
  } catch {
    return "unknown";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("analytics-consent", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("analytics-consent", callback);
  };
}
function seen(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function remember(key: string) {
  try {
    const keys = Object.keys(sessionStorage).filter(
      (k) => k.startsWith("ap-event:") || k.startsWith("ap-page:"),
    );
    if (keys.length >= 500) sessionStorage.removeItem(keys[0]);
    sessionStorage.setItem(key, "1");
  } catch {
    /* La deduplicación de compra permanece en PostgreSQL. */
  }
}
export function AnalyticsProvider({
  config,
  children,
}: {
  config: AnalyticsConfig;
  children: React.ReactNode;
}) {
  const choice = useSyncExternalStore(subscribe, consent, () => "unknown");
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const memory = useRef(new Set<string>());
  const ready = config.enabled && choice === "granted" && loaded;
  const common = useMemo(
    () => analyticsContext(config, pathname),
    [config, pathname],
  );
  const track = useCallback(
    (name: CommerceEvent, value: Commerce, key: string) => {
      if (!ready || consent() !== "granted") return false;
      const safe = safeCommerce(value),
        id = `ap-event:${config.measurementId}:${config.experimentId}:${name}:${key}`;
      if (!safe || memory.current.has(id) || seen(id)) return false;
      if (memory.current.size >= 500)
        memory.current.delete(memory.current.values().next().value!);
      memory.current.add(id);
      remember(id);
      window.gtag("event", name, { ...common, ...safe });
      return true;
    },
    [ready, common, config],
  );
  useEffect(() => {
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${config.measurementId}`
    ] = choice !== "granted";
  }, [choice, config.measurementId]);
  function choose(value: string) {
    try {
      localStorage.setItem(consentKey, value);
    } catch {
      /* Sin persistencia, no habilitar analítica. */
    }
    window.dispatchEvent(new Event("analytics-consent"));
  }
  function revoke() {
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${config.measurementId}`
    ] = true;
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.trim().split("=")[0];
      if (name === "_ga" || name.startsWith("_ga_")) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
      }
    }
    choose("unknown");
    location.reload();
  }
  function initialize() {
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        // eslint-disable-next-line prefer-rest-params -- El contrato oficial de gtag encola objetos Arguments.
        window.dataLayer.push(arguments);
      };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", config.measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ...common,
    });
    setLoaded(true);
  }
  return (
    <Context.Provider value={{ ready, config, track }}>
      <Suspense fallback={null}><PageViews /></Suspense>
      {children}
      {config.enabled && choice === "granted" && (
        <Script
          id="autoparts-ga4"
          src={`https://www.googletagmanager.com/gtag/js?id=${config.measurementId}`}
          strategy="afterInteractive"
          onReady={initialize}
        />
      )}
      {config.enabled && choice === "unknown" && (
        <aside
          className="analytics-consent"
          aria-label="Preferencias de analítica"
        >
          <p>
            ¿Permites analítica opcional para evaluar esta tienda académica?
            Puedes cambiar tu decisión. No enviamos datos de tu cuenta.
          </p>
          <button
            className="button button-red"
            onClick={() => choose("granted")}
          >
            Aceptar analítica
          </button>
          <button
            className="button button-dark"
            onClick={() => choose("denied")}
          >
            Rechazar analítica
          </button>
        </aside>
      )}
      {config.enabled && choice !== "unknown" && (
        <button className="analytics-preferences" onClick={revoke}>
          Preferencias de analítica
        </button>
      )}
    </Context.Provider>
  );
}
function PageViews() {
  const { ready, config } = useAnalytics();
  const pathname = usePathname(), search = useSearchParams().toString();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    // Los parámetros solo identifican transiciones en memoria, nunca se envían.
    const navigation = pathname + "?" + search;
    if (!ready || previous.current === navigation) return;
    previous.current = navigation;
    const common = analyticsContext(config, pathname);
    window.gtag("set", { page_location: common.page_location, page_referrer: "", page_title: common.page_title });
    window.gtag("event", "page_view", common);
  }, [ready, config, pathname, search]);
  return null;
}
export function useAnalytics() {
  const value = useContext(Context);
  if (!value) throw new Error("Falta AnalyticsProvider");
  return value;
}
export function CommerceView({
  name,
  value,
  eventKey,
}: {
  name: "view_item" | "begin_checkout";
  value: Commerce;
  eventKey: string;
}) {
  const { track } = useAnalytics();
  const observation = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    // Identidad por montaje, conservada durante el replay de efectos de StrictMode.
    // Volver al producto/checkout o recargar crea otra observación legítima.
    if (observation.current?.key !== eventKey)
      observation.current = { key: eventKey, id: crypto.randomUUID() };
    track(name, value, `${observation.current.id}:${eventKey}`);
  }, [name, value, eventKey, track]);
  return null;
}
export function PurchaseEvent({ orderId }: { orderId: string }) {
  const { ready, track } = useAnalytics();
  const attempted = useRef(false);
  useEffect(() => {
    if (!ready || attempted.current) return;
    attempted.current = true;
    void fetch(`/api/v1/orders/${orderId}/analytics-purchase`, {
      method: "POST",
      headers: { "X-Analytics-Consent": "granted" },
    })
      .then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          if (result.data) track("purchase", result.data, orderId);
        }
      })
      .catch(() => {
        /* Sin reintento automático: reclamo no confirma recepción. */
      });
  }, [ready, orderId, track]);
  return null;
}
