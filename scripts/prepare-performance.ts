import { execFileSync } from 'node:child_process';
import { performanceIsolation } from '../src/lib/observability/performance-isolation';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedCatalog } from '../prisma/seed';

// Exclusivamente dentro del contenedor sin salida a Internet y base exclusiva.
if (!performanceIsolation(process.env)) throw new Error('Preparación fuera del laboratorio bloqueada.');
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
try {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'pipe', timeout: 120000 });
  // El volumen debe ser nuevo; nunca resembrar un catálogo con actividad.
  const counts = await Promise.all([client.product.count(), client.user.count(), client.cart.count(), client.order.count(), client.paymentAttempt.count()]);
  if (counts.some(n => n !== 0)) throw new Error('La base no está vacía; no se modificó el catálogo.');
  console.log(JSON.stringify(await seedCatalog(client, Number(process.env.CATALOG_SIZE))));
} catch {
  console.error('Preparación aislada detenida. Revisar estado local; no reintentar automáticamente.');
  process.exitCode = 1;
} finally { await client.$disconnect(); }
