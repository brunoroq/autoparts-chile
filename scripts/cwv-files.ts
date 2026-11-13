import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { uuid } from './cwv-protocol';

/** Namespace nuevo: jamás reciclar la carpeta normal-closed o aceptar rutas del CLI. */
export function allocateCwvOutput(environmentDirectory:string,measurementId:string) {
  if(!uuid.test(measurementId))throw new Error('CWV_OUTPUT_ID_INVALID');
  const parent=path.join(environmentDirectory,'measurements');
  mkdirSync(parent,{recursive:true});
  const output=path.join(parent,measurementId);
  mkdirSync(output,{recursive:false}); // EEXIST detiene el comando antes de cambiar configuración.
  return output;
}
