/** La propiedad oficial nunca es un destino válido para experimentos sintéticos. */
export const OFFICIAL_MEASUREMENT_ID = "G-VVKYV486NP";
export function validSyntheticId(id: string | undefined, humanId?: string) {
  return !!id && /^G-[A-Z0-9]{5,20}$/.test(id) &&
    id !== OFFICIAL_MEASUREMENT_ID && id !== humanId;
}
