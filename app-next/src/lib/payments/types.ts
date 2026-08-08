export type PaymentProvider =
  | "moncash"
  | "natcash"
  | "paypal"
  | "mannitoks"
  | "remitly"
  | "western_union"
  | "taptap_send"
  | "other";

export type PaymentStatus =
  | "DRAFT"
  | "PENDING"
  | "PENDING_REVIEW"
  | "PROCESSING"
  | "CONFIRMED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentMode = "AUTOMATIC" | "MANUAL" | "EXTERNAL_REDIRECT";

export type PaymentCurrency = "HTG" | "USD";

export interface ContributionInput {
  amount: number;
  currency: PaymentCurrency;
  provider: PaymentProvider;
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  message?: string;
  anonymous?: boolean;
}

export interface PublicWalletConfiguration {
  displayName: string | null;
  number: string | null;
  merchantCode: string | null;
  qrUrl: string | null;
}

export interface ExternalTransferProvider {
  id: Exclude<PaymentProvider, "moncash" | "natcash" | "paypal" | "other">;
  name: string;
  enabled: boolean;
  supportedDestinations: Array<"MONCASH" | "NATCASH">;
  publicUrl: string | null;
  instructions: string;
}

export interface PublicPaymentMethod {
  id: PaymentProvider;
  name: string;
  badge: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  mode: PaymentMode;
  currencies: PaymentCurrency[];
}

export interface PublicPaymentConfiguration {
  suggestedAmountsHtg: readonly number[];
  methods: PublicPaymentMethod[];
  paypal: {
    clientId: string;
    hostedButtonId: string | null;
  };
  wallets: {
    moncash: PublicWalletConfiguration;
    natcash: PublicWalletConfiguration;
  };
  externalTransfers: ExternalTransferProvider[];
}
