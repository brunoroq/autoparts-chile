import "dotenv/config";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpus, totalmem, platform, release } from "node:os";
import { experimentContext } from "../src/lib/observability/config";
console.log(
  JSON.stringify(
    {
      event: "experiment_manifest",
      timestamp: new Date().toISOString(),
      ...experimentContext(),
      suggestedNewExperimentId: randomUUID(),
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      workingTreeDirty: !!execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim(),
      node: process.version,
      platform: platform(),
      osRelease: release(),
      logicalCpus: cpus().length,
      totalMemoryBytes: totalmem(),
      resourcesEnabled: process.env.RESOURCE_METRICS_ENABLED === "true",
      resourceSampleMs: Number(process.env.RESOURCE_SAMPLE_MS || 15000),
      webVitalsEnabled: process.env.WEB_VITALS_ENABLED === "true",
      analyticsEnabled: process.env.ANALYTICS_ENABLED === "true",
      paymentProvider: process.env.PAYMENT_PROVIDER || "simulated",
    },
    null,
    2,
  ),
);
