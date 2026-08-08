"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RiArrowRightUpLine,
  RiBankCardLine,
  RiCheckboxCircleLine,
  RiFileCopyLine,
  RiInformationLine,
  RiLock2Line,
  RiUserLine,
} from "react-icons/ri";
import type {
  PaymentProvider,
  PublicPaymentConfiguration,
  PublicPaymentMethod,
} from "@/lib/payments/types";
import { PayPalHostedButton } from "./PayPalHostedButton";
import styles from "./support.module.css";

type ContributionState = {
  reference: string;
  provider: PaymentProvider;
  amount: number;
  currency: "HTG" | "USD";
  status: string;
  payment_mode: "AUTOMATIC" | "MANUAL" | "EXTERNAL_REDIRECT";
  redirectUrl?: string;
};

const FAQ = [
  {
    question: "À quoi servent les contributions ?",
    answer:
      "Elles participent aux frais d’hébergement, aux outils de collecte, à la qualité des données et au développement de nouvelles fonctions.",
  },
  {
    question: "Puis-je contribuer sans carte bancaire ?",
    answer:
      "Oui. MonCash et NatCash fonctionnent en validation manuelle lorsque leurs coordonnées sont configurées.",
  },
  {
    question: "Comment contribuer depuis l’étranger ?",
    answer:
      "Les services externes configurés peuvent vous rediriger vers leur site. Leur disponibilité dépend de votre pays.",
  },
  {
    question: "Pourquoi ma contribution est-elle en attente ?",
    answer:
      "Une confirmation manuelle doit être vérifiée par l’équipe avant de passer au statut confirmé.",
  },
  {
    question: "Planète HMI conserve-t-elle mes informations financières ?",
    answer:
      "Non. Planète HMI ne collecte jamais votre numéro de carte, votre code secret, votre OTP ni le mot de passe de votre portefeuille.",
  },
  {
    question: "Puis-je rester anonyme ?",
    answer:
      "Oui. Vous pouvez masquer votre nom public tout en fournissant les informations minimales nécessaires à la vérification.",
  },
];

const PAYMENT_ICONS: Partial<Record<PaymentProvider, string>> = {
  moncash: "/brand/payments/moncash-icon.jpg",
  natcash: "/brand/payments/natcash-icon.jpg",
  paypal: "/brand/payments/paypal-icon.jpg",
};

export function SupportExperience({
  configuration,
  paymentNotice,
}: {
  configuration: PublicPaymentConfiguration;
  paymentNotice?: "verification-error" | "pending" | null;
}) {
  const firstConfigured = configuration.methods.find(
    (method) => method.enabled && method.configured,
  );
  const [provider, setProvider] = useState<PaymentProvider>(
    firstConfigured?.id ?? "moncash",
  );
  const [amountChoice, setAmountChoice] = useState<number | "custom">(250);
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [contribution, setContribution] = useState<ContributionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const returnNotice =
    paymentNotice === "verification-error"
      ? "MonCash n’a pas encore pu confirmer cette transaction. Aucun paiement n’est considéré comme confirmé sans vérification auprès de MonCash."
      : paymentNotice === "pending"
        ? "Le paiement a été transmis et sa vérification est encore en cours."
        : null;

  const selectedMethod = configuration.methods.find((method) => method.id === provider);
  const externalMethod = configuration.externalTransfers.find(
    (method) => method.id === provider,
  );
  const currency: "HTG" | "USD" = provider === "paypal" ? "USD" : "HTG";
  const amount = amountChoice === "custom" ? Number(customAmount) : amountChoice;
  const wallet =
    provider === "moncash" || provider === "natcash"
      ? configuration.wallets[provider]
      : null;
  const enabledExternals = useMemo(
    () =>
      configuration.externalTransfers.filter(
        (method) => method.enabled && method.publicUrl,
      ),
    [configuration.externalTransfers],
  );
  const allMethods = useMemo(
    () => [
      ...configuration.methods,
      ...enabledExternals.map<PublicPaymentMethod>((method) => ({
        id: method.id,
        name: method.name,
        badge: "Depuis l’étranger",
        description: "Transférez vers un portefeuille mobile avec un service externe.",
        enabled: true,
        configured: true,
        mode: "EXTERNAL_REDIRECT",
        currencies: ["HTG"],
      })),
    ],
    [configuration.methods, enabledExternals],
  );

  function chooseProvider(nextProvider: PaymentProvider) {
    setProvider(nextProvider);
    setContribution(null);
    setError(null);
    idempotencyKey.current = null;
  }

  async function prepareContribution() {
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Choisissez un montant strictement supérieur à zéro.");
      return;
    }
    setSubmitting(true);
    setError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/contributions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          provider,
          donorName,
          donorEmail,
          donorPhone,
          message,
          anonymous,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Préparation impossible.");
      setContribution(payload.contribution);
      if (payload.contribution.redirectUrl) {
        window.location.assign(payload.contribution.redirectUrl);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Préparation impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className={styles.checkoutIntro}>
        <p className={styles.eyebrow}>Contribution volontaire</p>
        <h1 id="support-title">Soutenir Planète HMI</h1>
        <p>Aidez-nous à documenter et faire rayonner la musique haïtienne.</p>
      </header>

      {returnNotice ? (
        <p className={`${styles.notice} ${styles.returnNotice}`} role="status">
          {returnNotice}
        </p>
      ) : null}

      <section className={styles.checkoutShell} aria-labelledby="support-title">
        <div className={styles.checkoutCard}>
          <div className={styles.checkoutSection}>
            <div className={styles.checkoutSectionTitle}>
              <RiBankCardLine aria-hidden="true" />
              <div>
                <h2>Moyen de paiement</h2>
                <p>Sélectionnez la solution qui vous convient.</p>
              </div>
            </div>
            <div className={styles.methods}>
              {allMethods.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  disabled={!method.enabled || !method.configured}
                  className={provider === method.id ? styles.selectedMethod : ""}
                  aria-pressed={provider === method.id}
                  onClick={() => chooseProvider(method.id)}
                >
                  <span className={styles.methodMain}>
                    {PAYMENT_ICONS[method.id] ? (
                      <span className={styles.methodLogo} aria-hidden="true">
                        <img src={PAYMENT_ICONS[method.id]} alt="" />
                      </span>
                    ) : null}
                    <span className={styles.methodCopy}>
                      <strong>{method.name}</strong>
                      <small>{method.description}</small>
                    </span>
                  </span>
                  <em>{method.enabled && method.configured ? method.badge : "Indisponible"}</em>
                </button>
              ))}
            </div>
          </div>

          {provider !== "paypal" ? (
            <div className={styles.checkoutSection}>
              <div className={styles.checkoutSectionTitle}>
                <span className={styles.currencyIcon} aria-hidden="true">G</span>
                <div>
                  <h2 id="amount-title">Montant</h2>
                  <p>Choisissez un montant en gourdes haïtiennes.</p>
                </div>
              </div>
              <div className={styles.amounts}>
                {configuration.suggestedAmountsHtg.map((suggestedAmount) => (
                  <button
                    key={suggestedAmount}
                    type="button"
                    className={amountChoice === suggestedAmount ? styles.selectedAmount : ""}
                    aria-pressed={amountChoice === suggestedAmount}
                    onClick={() => {
                      setAmountChoice(suggestedAmount);
                      setContribution(null);
                      idempotencyKey.current = null;
                    }}
                  >
                    {suggestedAmount.toLocaleString("fr-HT")} HTG
                  </button>
                ))}
                <button
                  type="button"
                  className={amountChoice === "custom" ? styles.selectedAmount : ""}
                  aria-pressed={amountChoice === "custom"}
                  onClick={() => {
                    setAmountChoice("custom");
                    setContribution(null);
                    idempotencyKey.current = null;
                  }}
                >
                  Autre montant
                </button>
              </div>
              {amountChoice === "custom" ? (
                <label className={styles.field}>
                  <span>Montant en HTG</span>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(event) => {
                      setCustomAmount(event.target.value);
                      setContribution(null);
                      idempotencyKey.current = null;
                    }}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {provider !== "paypal" ? (
            <details className={styles.optionalDetails}>
              <summary><RiUserLine aria-hidden="true" /> Ajouter mes coordonnées (facultatif)</summary>
              <div className={styles.identityGrid}>
                <label className={styles.field}>
                  <span>Nom ou pseudonyme</span>
                  <input value={donorName} maxLength={120} onChange={(event) => setDonorName(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Adresse e-mail</span>
                  <input type="email" value={donorEmail} maxLength={254} onChange={(event) => setDonorEmail(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Téléphone</span>
                  <input type="tel" value={donorPhone} maxLength={40} onChange={(event) => setDonorPhone(event.target.value)} />
                </label>
                <label className={`${styles.field} ${styles.messageField}`}>
                  <span>Message</span>
                  <textarea value={message} maxLength={1000} rows={3} onChange={(event) => setMessage(event.target.value)} />
                </label>
                <label className={styles.checkbox}>
                  <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                  <span>Rester anonyme publiquement</span>
                </label>
              </div>
            </details>
          ) : null}

          <div className={styles.paymentAction}>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            {provider === "paypal" && configuration.paypal.hostedButtonId ? (
              <PayPalHostedButton
                clientId={configuration.paypal.clientId}
                hostedButtonId={configuration.paypal.hostedButtonId}
              />
            ) : null}

            {!contribution && provider !== "paypal" ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={submitting || (!selectedMethod?.configured && !externalMethod?.enabled)}
                onClick={prepareContribution}
              >
                {submitting
                  ? "Préparation…"
                  : provider === "moncash"
                    ? "Continuer avec MonCash"
                    : provider === "natcash"
                      ? "Afficher les instructions NatCash"
                      : "Continuer"}
              </button>
            ) : null}

            {contribution?.payment_mode === "AUTOMATIC" && contribution.redirectUrl ? (
          <div className={styles.externalInstructions}>
            <RiInformationLine aria-hidden="true" />
            <div>
              <h3>Paiement MonCash sécurisé</h3>
              <p>
                Vous allez terminer le paiement sur le portail officiel MonCash.
                Le statut sera vérifié auprès de MonCash à votre retour.
              </p>
              <a href={contribution.redirectUrl}>
                Continuer vers MonCash <RiArrowRightUpLine aria-hidden="true" />
              </a>
            </div>
          </div>
            ) : null}

            {contribution?.payment_mode === "MANUAL" && wallet ? (
          <WalletInstructions
            provider={provider === "moncash" ? "MonCash" : "NatCash"}
            wallet={wallet}
            contribution={contribution}
          />
            ) : null}

            {contribution && externalMethod?.publicUrl ? (
          <ExternalInstructions
            name={externalMethod.name}
            url={externalMethod.publicUrl}
            contribution={contribution}
          />
            ) : null}

            {contribution && contribution.payment_mode !== "AUTOMATIC" && (wallet || externalMethod) ? (
              <ManualConfirmationForm contribution={contribution} />
            ) : null}
          </div>
        </div>

        <aside className={styles.orderSummary} aria-label="Récapitulatif de la contribution">
          <h2>Récapitulatif</h2>
          <dl>
            <div><dt>Moyen</dt><dd>{selectedMethod?.name ?? externalMethod?.name ?? provider}</dd></div>
            <div><dt>Montant</dt><dd>{provider === "paypal" ? "Confirmé dans PayPal" : `${Number.isFinite(amount) ? amount.toLocaleString("fr-HT") : "0"} HTG`}</dd></div>
            <div><dt>Frais Planète HMI</dt><dd>0 HTG</dd></div>
          </dl>
          <div className={styles.secureNote}>
            <RiLock2Line aria-hidden="true" />
            <p><strong>Paiement protégé</strong><span>Vos codes, mots de passe et informations bancaires ne transitent jamais par Planète HMI.</span></p>
          </div>
          <p className={styles.providerNote}>
            {wallet && selectedMethod?.mode === "MANUAL"
              ? `Le transfert est effectué dans l’application ${selectedMethod.name}, puis vérifié manuellement par Planète HMI.`
              : "La transaction est finalisée sur le portail officiel du fournisseur choisi."}
          </p>
        </aside>
      </section>

      <section className={styles.afterCheckout}>
        <details className={styles.supportTools}>
          <summary>Déjà effectué un paiement ?</summary>
          <div className={styles.statusLookup}>
            <div>
              <h2>Suivre une contribution</h2>
              <p>Saisissez la référence Planète HMI reçue.</p>
            </div>
            <StatusLookup />
          </div>
        </details>
        <details className={styles.supportTools}>
          <summary>Questions sur les paiements</summary>
          <div className={styles.compactFaq}>
            {FAQ.slice(0, 4).map((item) => (
              <div key={item.question}><strong>{item.question}</strong><p>{item.answer}</p></div>
            ))}
          </div>
        </details>
        <div className={styles.security}>
          <RiLock2Line aria-hidden="true" />
          <p>Ne transmettez jamais votre PIN, votre OTP ou votre mot de passe.</p>
        </div>
      </section>
    </>
  );
}

function WalletInstructions({
  provider,
  wallet,
  contribution,
}: {
  provider: string;
  wallet: PublicPaymentConfiguration["wallets"]["moncash"];
  contribution: ContributionState;
}) {
  return (
    <div className={styles.walletInstructions}>
      <div>
        <h3>Envoyer avec {provider}</h3>
        <p className={styles.walletNotice}>
          <RiInformationLine aria-hidden="true" />
          Transfert vers un compte personnel. La confirmation par Planète HMI est manuelle.
        </p>
        <ol>
          <li>Ouvrez votre portefeuille {provider}.</li>
          <li>Envoyez exactement {contribution.amount.toLocaleString("fr-HT")} {contribution.currency}.</li>
          <li>Conservez le numéro de transaction.</li>
          <li>Revenez ici pour transmettre votre confirmation.</li>
        </ol>
      </div>
      <div className={styles.walletDetails}>
        {wallet.qrUrl ? (
          <div className={styles.qrCode}>
            <a
              href={wallet.qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ouvrir le QR code ${provider} en plein écran`}
            >
              <img src={wallet.qrUrl} alt={`QR code de transfert ${provider}`} />
            </a>
            <a href={wallet.qrUrl} target="_blank" rel="noopener noreferrer">
              Ouvrir le QR en plein écran
            </a>
          </div>
        ) : null}
        {wallet.displayName ? <CopyRow label="Bénéficiaire" value={wallet.displayName} /> : null}
        {wallet.number ? <CopyRow label={`Numéro ${provider}`} value={wallet.number} /> : null}
        {wallet.merchantCode ? <CopyRow label="Code marchand" value={wallet.merchantCode} /> : null}
        <CopyRow label="Référence Planète HMI" value={contribution.reference} />
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.copyRow}>
      <span><small>{label}</small><strong>{value}</strong></span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
        aria-label={`Copier ${label}`}
      >
        {copied ? <RiCheckboxCircleLine /> : <RiFileCopyLine />}
      </button>
    </div>
  );
}

function ExternalInstructions({
  name,
  url,
  contribution,
}: {
  name: string;
  url: string;
  contribution: ContributionState;
}) {
  return (
    <div className={styles.externalInstructions}>
      <RiInformationLine aria-hidden="true" />
      <div>
        <h3>Continuer avec {name}</h3>
        <p>
          Vous allez être redirigé vers un service externe. Planète HMI ne contrôle
          pas ses frais, ses délais ni sa disponibilité dans votre pays.
        </p>
        <p>
          Cette redirection ne confirme aucun paiement. Revenez ensuite transmettre
          votre numéro de transaction avec la référence {contribution.reference}.
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Continuer vers le service <RiArrowRightUpLine aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function ManualConfirmationForm({
  contribution,
}: {
  contribution: ContributionState;
}) {
  const [transactionCode, setTransactionCode] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError(null);
    const formData = new FormData();
    formData.set("reference", contribution.reference);
    formData.set("transactionCode", transactionCode);
    formData.set("amount", String(contribution.amount));
    formData.set("donorName", donorName);
    formData.set("donorPhone", donorPhone);
    formData.set("message", message);
    if (proof) formData.set("proof", proof);
    try {
      const response = await fetch("/api/contributions/manual-proof", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Envoi impossible.");
      setState("sent");
    } catch (caught) {
      setState("idle");
      setError(caught instanceof Error ? caught.message : "Envoi impossible.");
    }
  }

  if (state === "sent") {
    return (
      <div className={styles.sentState} role="status">
        <RiCheckboxCircleLine aria-hidden="true" />
        <div>
          <h3>Confirmation transmise</h3>
          <p>
            Elle sera examinée avant que la contribution soit marquée comme confirmée.
          </p>
          <Link href={`/support/status/${contribution.reference}`}>
            Consulter le statut
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.manualForm} onSubmit={submit}>
      <div>
        <h3>Transmettre votre confirmation</h3>
        <p>La capture est facultative et ne vaut jamais confirmation automatique.</p>
      </div>
      <label className={styles.field}>
        <span>Numéro ou identifiant de transaction</span>
        <input required minLength={3} maxLength={160} value={transactionCode} onChange={(event) => setTransactionCode(event.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Montant envoyé</span>
        <input value={`${contribution.amount} ${contribution.currency}`} readOnly />
      </label>
      <label className={styles.field}>
        <span>Nom ou pseudonyme</span>
        <input maxLength={120} value={donorName} onChange={(event) => setDonorName(event.target.value)} />
      </label>
      <label className={styles.field}>
        <span>Téléphone facultatif</span>
        <input type="tel" maxLength={40} value={donorPhone} onChange={(event) => setDonorPhone(event.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.messageField}`}>
        <span>Message facultatif</span>
        <textarea rows={3} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <label className={`${styles.field} ${styles.messageField}`}>
        <span>Capture facultative</span>
        <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setProof(event.target.files?.[0] ?? null)} />
        <small>PNG, JPG, WebP ou PDF, 5 Mo maximum.</small>
      </label>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button className={styles.primaryButton} type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Transmission…" : "Envoyer la confirmation"}
      </button>
    </form>
  );
}

function StatusLookup() {
  const [reference, setReference] = useState("");
  return (
    <form
      className={styles.statusForm}
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = reference.trim().toUpperCase();
        if (/^HMI-[A-Z0-9]{6}-[A-Z0-9]{10}$/.test(normalized)) {
          window.location.href = `/support/status/${normalized}`;
        }
      }}
    >
      <label className={styles.field}>
        <span>Référence</span>
        <input
          value={reference}
          placeholder="HMI-XXXXXX-XXXXXXXXXX"
          onChange={(event) => setReference(event.target.value)}
        />
      </label>
      <button type="submit">Consulter</button>
    </form>
  );
}
