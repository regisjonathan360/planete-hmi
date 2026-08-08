import "server-only";

import { getPublicPaymentConfiguration } from "./config";
import type { ExternalTransferProvider } from "./types";

export function getEnabledExternalTransfers(): ExternalTransferProvider[] {
  return getPublicPaymentConfiguration().externalTransfers.filter(
    (provider) => provider.enabled && Boolean(provider.publicUrl),
  );
}
