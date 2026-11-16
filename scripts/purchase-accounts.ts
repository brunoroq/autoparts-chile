import { createHmac } from 'node:crypto';
// Credenciales exclusivas reproducibles en memoria, sin archivo de contraseñas.
export function purchaseAccount(environmentId: string, secret: string, index: number) {
  if (!/^[a-f0-9-]{36}$/.test(environmentId) || !/^[a-f0-9]{64}$/.test(secret) || !Number.isInteger(index) || index < 1 || index > 10) throw new Error('PURCHASE_ACCOUNT_CONFIGURATION_INVALID');
  return { name: 'Compra sintética ' + index, email: 'buyer-' + index + '-' + environmentId + '@example.invalid',
    password: createHmac('sha256', secret).update('purchase-account:' + environmentId + ':' + index).digest('hex') };
}
