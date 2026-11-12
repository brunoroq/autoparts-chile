// Perfiles cerrados: no confundir concurrencia con solicitudes por segundo.
export const profiles = {
  baja: [{ duration: '30s', target: 3 }, { duration: '120s', target: 3 }, { duration: '30s', target: 0 }],
  normal: [{ duration: '60s', target: 10 }, { duration: '300s', target: 10 }, { duration: '60s', target: 0 }],
  pico: [{ duration: '60s', target: 10 }, { duration: '30s', target: 30 }, { duration: '60s', target: 30 }, { duration: '60s', target: 0 }],
};
export const limits = Object.freeze({ maxVus: 30, maxSeconds: 600, maxRequests: 10000 });
export function durationSeconds(stages) {
  return stages.reduce((total, stage) => total + Number(stage.duration.slice(0, -1)), 0);
}
export function buildScenario(plan) {
  const stages = profiles[plan.profile];
  if (plan.model === 'arrival') {
    const peak = Math.max(...stages.map(s => s.target));
    return { executor: 'ramping-arrival-rate', startRate: 1, timeUnit: '1s', preAllocatedVUs: plan.maxVus, maxVUs: plan.maxVus, gracefulStop: '5s', stages: stages.map(s => ({ duration: s.duration, target: Math.round(s.target / peak * plan.peakRate) })) };
  }
  return { executor: 'ramping-vus', startVUs: 1, stages, gracefulRampDown: '5s', gracefulStop: '5s' };
}
