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
} from "react";
import { usePathname } from "next/navigation";
import {
  normalizedPath,
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
  const previous = useRef("");
  const memory = useRef(new Set<string>());
  const ready = config.enabled && choice === "granted" && loaded;
  const common = useMemo(
    () => ({
      environment: config.environment,
      experiment_id: config.experimentId,
      traffic_kind: config.traffic,
      debug_mode: config.debug,
      page_location: config.origin + normalizedPath(pathname),
      page_referrer: "",
      page_title: "AutoParts Chile " + normalizedPath(pathname),
    }),
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
  useEffect(() => {
    if (!ready || previous.current === pathname) return;
    previous.current = pathname;
    // Reemplaza URL y título completos; nunca consulta, token, término libre ni ID privado.
    window.gtag("set", {
      page_location: common.page_location,
      page_referrer: "",
      page_title: common.page_title,
    });
    const id = `ap-page:${config.measurementId}:${pathname}`;
    if (!seen(id)) {
      remember(id);
      window.gtag("event", "page_view", common);
    }
  }, [ready, pathname, common, config.measurementId]);
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
  useEffect(() => {
    track(name, value, eventKey);
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
