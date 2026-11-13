const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** La ausencia de Analytics en el marcador antiguo no reemplaza inspeccionar Config.Env. */
export function validateOriginalObserverMarker(marker, expectedRunId, catalogSize, effectiveEnv) {
  if (!effectiveEnv || effectiveEnv.ANALYTICS_ENABLED !== 'false' ||
      ![undefined, ''].includes(effectiveEnv.GA4_MEASUREMENT_ID) ||
      ![undefined, ''].includes(effectiveEnv.GA4_SYNTHETIC_MEASUREMENT_ID)) {
    throw new Error('ORIGINAL_ANALYTICS_CONFIG_INVALID');
  }
  if (!uuid.test(expectedRunId || '') || ![30, 1000, 10000].includes(catalogSize) ||
      !marker || typeof marker !== 'object' || Array.isArray(marker) ||
      marker.isolated !== true || marker.runId !== expectedRunId || marker.catalogSize !== catalogSize ||
      // Campos nuevos son opcionales solo en el original; si existen, no pueden contradecirlo.
      ('analytics' in marker && marker.analytics !== false) ||
      ('measurementId' in marker && marker.measurementId !== '') ||
      ('observer' in marker && marker.observer !== false) ||
      ('origin' in marker && marker.origin !== 'http://127.0.0.1:3100')) {
    throw new Error('ORIGINAL_MARKER_INVALID');
  }
  return {isolated:true, runId:expectedRunId, catalogSize};
}
