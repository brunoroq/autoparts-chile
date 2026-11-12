// Sin servicios externos ni extensiones; nombres de métricas controlados por el script.
export function summaryFiles(data, plan) {
  const rows = ['metric,stat,value'];
  for (const [metric, record] of Object.entries(data.metrics || {})) {
    for (const [stat, value] of Object.entries(record.values || {})) {
      if (typeof value === 'number') rows.push(`${metric},${stat},${value}`);
    }
  }
  return {
    [`${plan.output}/summary.json`]: JSON.stringify({ plan, results: data }, null, 2),
    [`${plan.output}/summary.csv`]: rows.join('\n') + '\n',
  };
}
