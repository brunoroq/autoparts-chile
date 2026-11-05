export function dockerBytes(value: string) {
  const match = /^([0-9.]+)\s*(B|kB|KB|MB|GB|TB|KiB|MiB|GiB|TiB)$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const factors: Record<string, number> = {
    B: 1,
    kB: 1e3,
    KB: 1e3,
    MB: 1e6,
    GB: 1e9,
    TB: 1e12,
    KiB: 1024,
    MiB: 1024 ** 2,
    GiB: 1024 ** 3,
    TiB: 1024 ** 4,
  };
  const bytes = Number(match[1]) * factors[match[2]];
  return Number.isFinite(bytes) ? Math.round(bytes) : null;
}
export function dockerCounters(raw: Record<string, string>) {
  const pair = (value: string) => value.split("/").map(dockerBytes);
  const [memoryBytes, memoryLimitBytes] = pair(raw.MemUsage),
    [blockReadBytes, blockWriteBytes] = pair(raw.BlockIO),
    [networkRxBytes, networkTxBytes] = pair(raw.NetIO);
  return {
    cpuPercent: parseFloat(raw.CPUPerc),
    memoryPercent: parseFloat(raw.MemPerc),
    memoryBytes,
    memoryLimitBytes,
    blockReadBytes,
    blockWriteBytes,
    networkRxBytes,
    networkTxBytes,
    pids: Number(raw.PIDs),
  };
}
