import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { Pool } from "pg";
import { experimentContext } from "./config";
const state = globalThis as unknown as { resourceSampler?: boolean };
export function startResourceSampler() {
  if (
    process.env.VERCEL === "1" ||
    process.env.RESOURCE_METRICS_ENABLED !== "true" ||
    state.resourceSampler
  )
    return;
  state.resourceSampler = true;
  const interval = Number(process.env.RESOURCE_SAMPLE_MS || 15000);
  if (!Number.isInteger(interval) || interval < 5000 || interval > 300000)
    throw new Error("RESOURCE_SAMPLE_MS debe estar entre 5000 y 300000.");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 2000,
    statement_timeout: 2000,
    application_name: "autoparts-observer",
  });
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  let cpu = process.cpuUsage(),
    last = performance.now(),
    util = performance.eventLoopUtilization(),
    busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const now = performance.now(),
        nextCpu = process.cpuUsage(),
        nextUtil = performance.eventLoopUtilization(),
        memory = process.memoryUsage();
      console.log(
        JSON.stringify({
          event: "process_resources",
          timestamp: new Date().toISOString(),
          ...experimentContext(),
          cpuCorePercent:
            ((nextCpu.user - cpu.user + nextCpu.system - cpu.system) /
              1000 /
              (now - last)) *
            100,
          rssBytes: memory.rss,
          heapUsedBytes: memory.heapUsed,
          eventLoopUtilization: performance.eventLoopUtilization(nextUtil, util)
            .utilization,
          eventLoopDelayP95Ms: Number.isFinite(delay.percentile(95))
            ? delay.percentile(95) / 1e6
            : null,
          uptimeSeconds: process.uptime(),
        }),
      );
      cpu = nextCpu;
      last = now;
      util = nextUtil;
      delay.reset();
      const result = await pool.query(
        `SELECT count(*)::int AS connections, count(*) FILTER (WHERE state = 'active')::int AS active, count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS waiting_locks FROM pg_stat_activity WHERE datname = current_database() AND application_name <> 'autoparts-observer'`,
      );
      console.log(
        JSON.stringify({
          event: "postgres_resources",
          timestamp: new Date().toISOString(),
          ...experimentContext(),
          ...result.rows[0],
        }),
      );
    } catch {
      console.log(
        JSON.stringify({
          event: "resource_error",
          timestamp: new Date().toISOString(),
          ...experimentContext(),
          code: "RESOURCE_SAMPLE_FAILED",
        }),
      );
    } finally {
      busy = false;
    }
  }, interval);
  timer.unref();
}
