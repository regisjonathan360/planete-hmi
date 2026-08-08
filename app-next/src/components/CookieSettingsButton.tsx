"use client";

import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/privacy/consent";

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="footer-cookie-settings"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
    >
      Gérer mes cookies
    </button>
  );
}
