"use client";

import { useCallback, useRef, useState } from "react";
import Script from "next/script";
import styles from "./support.module.css";

interface PayPalHostedButtonProps {
  clientId: string;
  hostedButtonId: string;
}

declare global {
  interface Window {
    paypal?: {
      HostedButtons(options: { hostedButtonId: string }): {
        render(selector: string): Promise<void> | void;
      };
    };
  }
}

export function PayPalHostedButton({
  clientId,
  hostedButtonId,
}: PayPalHostedButtonProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const rendered = useRef(false);
  const containerId = `paypal-container-${hostedButtonId}`;
  const sdkUrl = new URL("https://www.paypal.com/sdk/js");
  sdkUrl.searchParams.set("client-id", clientId);
  sdkUrl.searchParams.set("components", "hosted-buttons");
  sdkUrl.searchParams.set("disable-funding", "venmo");
  sdkUrl.searchParams.set("currency", "USD");

  const renderButton = useCallback(async () => {
    if (rendered.current || !window.paypal) return;
    try {
      rendered.current = true;
      await window.paypal
        .HostedButtons({ hostedButtonId })
        .render(`#${containerId}`);
      setStatus("ready");
    } catch (error) {
      rendered.current = false;
      console.error(
        "[paypal-hosted-button] render failed",
        error instanceof Error ? error.message : error,
      );
      setStatus("error");
    }
  }, [containerId, hostedButtonId]);

  return (
    <div className={styles.paypalPanel}>
      <Script
        id="paypal-hosted-buttons-sdk"
        src={sdkUrl.toString()}
        strategy="afterInteractive"
        onLoad={() => void renderButton()}
        onReady={() => void renderButton()}
        onError={() => setStatus("error")}
      />
      <div className={styles.paypalHeading}>
        <div>
          <h3>Payer avec PayPal</h3>
          <p>
            Le paiement est traité par PayPal en dollars américains. Planète HMI
            ne reçoit jamais vos informations bancaires.
          </p>
        </div>
        <span>USD</span>
      </div>
      <div className={styles.paypalButton} aria-busy={status === "loading"}>
        <div id={containerId} />
        {status === "loading" ? (
          <div className={styles.paypalSkeleton} aria-label="Chargement du bouton PayPal" />
        ) : null}
        {status === "error" ? (
          <div className={styles.paypalError} role="alert">
            Le bouton PayPal n’a pas pu se charger. Vérifiez votre connexion puis réessayez.
          </div>
        ) : null}
      </div>
      <p className={styles.paypalReturnNotice}>
        Après le paiement, PayPal vous ramènera vers la page de remerciement de
        Planète HMI.
      </p>
    </div>
  );
}
