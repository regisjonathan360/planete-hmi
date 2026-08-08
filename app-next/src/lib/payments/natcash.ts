import "server-only";

export interface NatCashAutomaticAdapter {
  createPayment: (reference: string, amount: number, currency: "HTG") => Promise<unknown>;
  verifyPayment: (providerTransactionId: string) => Promise<unknown>;
}

// Aucune API n’est inventée. Cette interface fixe seulement le contrat attendu
// lorsqu’une documentation marchande officielle NatCash sera disponible.
export function getNatCashAutomaticAdapter(): NatCashAutomaticAdapter | null {
  return null;
}
