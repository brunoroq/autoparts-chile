export function validateOriginalObserverMarker(marker: unknown, expectedRunId: string, catalogSize: number,
  effectiveEnv: Record<string, string | undefined>): {isolated: true; runId: string; catalogSize: number};
