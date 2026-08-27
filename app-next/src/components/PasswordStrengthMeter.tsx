"use client";

import { passwordStrength, STRENGTH_COLORS } from "@/lib/password-strength";

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = passwordStrength(password);
  return (
    <div style={{ marginTop: "0.35rem" }}>
      <div style={{ display: "flex", gap: "4px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "4px",
              borderRadius: "2px",
              background: i <= Math.ceil(score / 1.34) && score > 0 ? STRENGTH_COLORS[score] : "rgba(244,239,228,0.12)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: "0.72rem", margin: "0.25rem 0 0", color: STRENGTH_COLORS[score] }}>
        Force : {label}
      </p>
    </div>
  );
}
