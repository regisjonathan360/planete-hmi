import "server-only";

import type {
  ExternalTransferProvider,
  PublicPaymentConfiguration,
  PublicPaymentMethod,
  PublicWalletConfiguration,
} from "./types";
import { getMonCashAutomaticConfiguration } from "./moncash";

export const SUGGESTED_AMOUNTS_HTG = [100, 250, 500, 1000] as const;

const PAYPAL_HOSTED_BUTTON_CLIENT_ID =
  "BAAVJ3IHZQcqASSM1ZDa2t8hHgjpoLFLgKAdoZEvP7c7ymbfMz36g9FJ5ff-NwKD9Kat0audyccv57D96s";
const PAYPAL_HOSTED_BUTTON_ID = "JDCLSL36KW6QQ";

const MANUAL_WALLETS = {
  MONCASH: {
    displayName: "Régis Jonathan",
    number: "+509 3732-9331",
    qrUrl: "/brand/payments/moncash-regis-jonathan.jpg",
  },
  NATCASH: {
    displayName: "Jonathan Regis",
    number: "+509 4159-8724",
    qrUrl: "/brand/payments/natcash-jonathan-regis.png",
  },
} as const;

function publicValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function wallet(prefix: "MONCASH" | "NATCASH"): PublicWalletConfiguration {
  const fallback = MANUAL_WALLETS[prefix];
  return {
    displayName:
      publicValue(`NEXT_PUBLIC_${prefix}_DISPLAY_NAME`) ?? fallback.displayName,
    number: publicValue(`NEXT_PUBLIC_${prefix}_NUMBER`) ?? fallback.number,
    merchantCode: publicValue(`NEXT_PUBLIC_${prefix}_MERCHANT_CODE`),
    qrUrl: publicValue(`NEXT_PUBLIC_${prefix}_QR_URL`) ?? fallback.qrUrl,
  };
}

function externalProvider(
  id: ExternalTransferProvider["id"],
  name: string,
  envName: string,
): ExternalTransferProvider {
  const publicUrl = publicValue(envName);
  return {
    id,
    name,
    enabled: Boolean(publicUrl),
    supportedDestinations: ["MONCASH", "NATCASH"],
    publicUrl,
    instructions: "Choisissez le portefeuille mobile indiqué par Planète HMI comme destination.",
  };
}

export function getPublicPaymentConfiguration(): PublicPaymentConfiguration {
  const moncash = wallet("MONCASH");
  const natcash = wallet("NATCASH");
  const moncashAutomatic =
    process.env.MONCASH_API_ENABLED === "true" &&
    Boolean(getMonCashAutomaticConfiguration());
  const paypalClientId =
    publicValue("NEXT_PUBLIC_PAYPAL_CLIENT_ID") ?? PAYPAL_HOSTED_BUTTON_CLIENT_ID;
  const paypalHostedButtonId =
    publicValue("NEXT_PUBLIC_PAYPAL_HOSTED_BUTTON_ID") ?? PAYPAL_HOSTED_BUTTON_ID;
  const paypalConfigured = Boolean(paypalClientId && paypalHostedButtonId);

  const methods: PublicPaymentMethod[] = [
    {
      id: "moncash",
      name: "MonCash",
      badge: moncashAutomatic ? "Paiement sécurisé" : "Transfert manuel",
      description: "Scannez le QR et envoyez depuis votre compte MonCash.",
      enabled: true,
      configured:
        moncashAutomatic || Boolean(moncash.number || moncash.merchantCode),
      mode: moncashAutomatic ? "AUTOMATIC" : "MANUAL",
      currencies: ["HTG"],
    },
    {
      id: "natcash",
      name: "NatCash",
      badge: "Transfert manuel",
      description:
        "Scannez le QR et envoyez depuis votre compte NatCash.",
      enabled: true,
      configured: Boolean(natcash.number || natcash.merchantCode),
      mode: "MANUAL",
      currencies: ["HTG"],
    },
    {
      id: "paypal",
      name: "PayPal",
      badge: "Paiement international",
      description: "Soutenez Planète HMI depuis votre compte PayPal.",
      enabled: true,
      configured: paypalConfigured,
      mode: "AUTOMATIC",
      currencies: ["USD"],
    },
  ];

  return {
    suggestedAmountsHtg: SUGGESTED_AMOUNTS_HTG,
    paypal: {
      clientId: paypalClientId,
      hostedButtonId: paypalHostedButtonId,
    },
    methods,
    wallets: { moncash, natcash },
    externalTransfers: [
      externalProvider("mannitoks", "Mannitòks", "NEXT_PUBLIC_MANNITOKS_URL"),
      externalProvider("remitly", "Remitly", "NEXT_PUBLIC_REMITLY_URL"),
      externalProvider("western_union", "Western Union", "NEXT_PUBLIC_WESTERN_UNION_URL"),
      externalProvider("taptap_send", "TapTap Send", "NEXT_PUBLIC_TAPTAP_SEND_URL"),
    ],
  };
}
