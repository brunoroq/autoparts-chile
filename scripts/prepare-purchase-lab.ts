import { execFileSync } from 'node:child_process';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { purchaseIsolation } from '../src/lib/observability/purchase-isolation';
import { hashPassword } from '../src/lib/auth/password';
import { seedCatalog } from '../prisma/seed';
import { purchaseAccount } from './purchase-accounts';

const marker = purchaseIsolation(process.env);
if (!marker) throw new Error('PURCHASE_PREPARATION_BLOCKED');
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
try {
  const identity = await client.$queryRaw<{ database: string; tables: bigint }[]>`SELECT current_database() AS database, (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tables`;
  if (identity[0].database !== 'autoparts_purchase_test' || Number(identity[0].tables) !== 0) throw new Error('PURCHASE_DATABASE_NOT_NEW');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'pipe', timeout: 120000, env: { ...process.env, CHECKPOINT_DISABLE: '1' } });
  const catalog = await seedCatalog(client, 30);
  for (let index = 1; index <= 10; index++) {
    const account = purchaseAccount(marker.runId!, process.env.NEXTAUTH_SECRET!, index);
    await client.user.create({ data: { name: account.name, email: account.email, passwordHash: await hashPassword(account.password), cart: { create: {} } } });
  }
  console.log(JSON.stringify({ operation: 'purchase-prepare', environmentId: marker.runId, ...catalog,
    users: await client.user.count(), carts: await client.cart.count(), orders: await client.order.count(), payments: await client.paymentAttempt.count() }));
} catch {
  console.error('PURCHASE_PREPARATION_STOPPED: revisar estado sin repetir ni reiniciar datos.'); process.exitCode = 1;
} finally { await client.$disconnect(); }
