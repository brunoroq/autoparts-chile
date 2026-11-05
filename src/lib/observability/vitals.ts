import { ApiError } from "../http/errors";
import { exactFields } from "../http/input";
import { normalizedPath } from "../analytics/contracts";
export type Vital = {
  id: string;
  name: "LCP" | "CLS" | "INP";
  value: number;
  sequence: number;
  path: string;
  device: "mobile" | "desktop";
  unit: "ms" | "score";
};
export function vitalsInput(body: Record<string, unknown>): Vital[] {
  exactFields(body, ["metrics"]);
  if (
    !Array.isArray(body.metrics) ||
    !body.metrics.length ||
    body.metrics.length > 12
  )
    throw new ApiError("Métricas inválidas.");
  return body.metrics.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new ApiError("Métrica inválida.");
    const v = raw as Record<string, unknown>;
    exactFields(v, ["id", "name", "value", "sequence", "path", "device"]);
    if (
      typeof v.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(v.id) ||
      !["LCP", "CLS", "INP"].includes(String(v.name)) ||
      typeof v.value !== "number" ||
      !Number.isFinite(v.value) ||
      v.value < 0 ||
      v.value > (v.name === "CLS" ? 100 : 3600000) ||
      !Number.isInteger(v.sequence) ||
      (v.sequence as number) < 1 ||
      (v.sequence as number) > 10000 ||
      typeof v.path !== "string" ||
      !["mobile", "desktop"].includes(String(v.device))
    )
      throw new ApiError("Métrica inválida.");
    return {
      id: v.id,
      name: v.name as Vital["name"],
      value: v.value,
      sequence: v.sequence as number,
      path: normalizedPath(v.path),
      device: v.device as Vital["device"],
      unit: v.name === "CLS" ? "score" : "ms",
    };
  });
}
