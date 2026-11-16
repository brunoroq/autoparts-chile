import { performanceIsolation } from '@/lib/observability/performance-isolation';
import { purchaseIsolation } from '@/lib/observability/purchase-isolation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Sin datos de conexión; fuera del laboratorio esta ruta permanece no disponible.
export function GET() {
  try {
    const marker = purchaseIsolation(process.env) || performanceIsolation(process.env);
    return Response.json(marker || { error: 'NOT_FOUND' }, { status: marker ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'ISOLATION_INVALID' }, { status: 503 });
  }
}
