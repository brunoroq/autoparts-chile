import { BASE_URL } from '../performance/k6/safety.js';

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

// La salud dentro del contenedor no prueba que Windows pueda acceder al puerto.
// Mantener el destino literal y no seguir redirecciones, incluso durante prepare.
export async function verifyPerformanceEndpoint(
  runId: string,
  catalogSize: number,
  request: Fetcher = fetch,
) {
  const response = await request(BASE_URL + '/api/performance/status', {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  const marker = await response.json();
  if (!response.ok || marker?.runId !== runId || marker?.catalogSize !== catalogSize || marker?.isolated !== true) {
    throw new Error('No se confirmó el acceso local al entorno aislado.');
  }
  return { isolated: true, runId, catalogSize };
}
