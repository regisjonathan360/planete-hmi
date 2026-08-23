"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────
export interface ImageData {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
}

export interface SphereImageGridProps {
  images: ImageData[];
  containerSize?: number;
  sphereRadius?: number;
  dragSensitivity?: number;
  momentumDecay?: number;
  maxRotationSpeed?: number;
  baseImageScale?: number;
  perspective?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  onImageClick?: (image: ImageData) => void;
  className?: string;
}

// ─── Math helpers ────────────────────────────────────────────────
const deg2rad = (d: number) => (d * Math.PI) / 180;
const normAngle = (a: number) => {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
};

// ─── Component ───────────────────────────────────────────────────
export default function SphereImageGrid({
  images,
  containerSize = 400,
  sphereRadius = 200,
  dragSensitivity = 0.5,
  momentumDecay = 0.95,
  maxRotationSpeed = 5,
  baseImageScale = 0.12,
  perspective = 1000,
  autoRotate = false,
  autoRotateSpeed = 0.3,
  onImageClick,
  className = "",
}: SphereImageGridProps) {
  const [selected, setSelected] = useState<ImageData | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lastMouse = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);

  // Mutable state — no re-renders
  const rotRef = useRef({ x: 15, y: 15 });
  const velRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const R = sphereRadius || containerSize * 0.5;
  const imgSize = containerSize * baseImageScale;

  // ── Pre-compute sphere positions (static, no deps) ─────────────
  const spherePositions = useMemo(() => {
    const pos: { theta: number; phi: number }[] = [];
    const n = images.length;
    const golden = (1 + Math.sqrt(5)) / 2;
    const inc = (2 * Math.PI) / golden;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let phi = Math.acos(1 - 2 * t) * (180 / Math.PI);
      let theta = ((inc * i * 180) / Math.PI) % 360;
      phi = 15 + (phi / 180) * 150;
      const rnd = (Math.random() - 0.5) * 20;
      theta = (theta + rnd) % 360;
      phi = Math.max(0, Math.min(180, phi + (Math.random() - 0.5) * 10));
      pos.push({ theta, phi });
    }
    return pos;
  }, [images.length]);

  // ── Animation loop — pure DOM, zero React re-renders ───────────
  useEffect(() => {
    const clamp = (s: number) =>
      Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, s));

    const loop = () => {
      // Update velocity & rotation (refs, no re-render)
      if (!draggingRef.current) {
        const v = velRef.current;
        v.x *= momentumDecay;
        v.y *= momentumDecay;
        if (!autoRotate && Math.abs(v.x) < 0.005 && Math.abs(v.y) < 0.005) {
          v.x = 0;
          v.y = 0;
        }
        const r = rotRef.current;
        let newY = r.y;
        if (autoRotate) newY += autoRotateSpeed;
        newY += clamp(v.y);
        r.x = normAngle(r.x + clamp(v.x));
        r.y = normAngle(newY);
      }

      // Compute & apply transforms directly to DOM
      const r = rotRef.current;
      const rxR = deg2rad(r.x);
      const ryR = deg2rad(r.y);
      const cosRy = Math.cos(ryR);
      const sinRy = Math.sin(ryR);
      const cosRx = Math.cos(rxR);
      const sinRx = Math.sin(rxR);
      const half = containerSize / 2;

      for (let i = 0; i < spherePositions.length; i++) {
        const el = itemsRef.current[i];
        if (!el) continue;

        const pos = spherePositions[i];
        const tR = deg2rad(pos.theta);
        const pR = deg2rad(pos.phi);

        let x = R * Math.sin(pR) * Math.cos(tR);
        let y = R * Math.cos(pR);
        let z = R * Math.sin(pR) * Math.sin(tR);

        const x1 = x * cosRy + z * sinRy;
        const z1 = -x * sinRy + z * cosRy;
        x = x1;
        z = z1;

        const y2 = y * cosRx - z * sinRx;
        const z2 = y * sinRx + z * cosRx;
        y = y2;
        z = z2;

        const visible = z > -30;
        if (!visible) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";

        let opacity = 1;
        if (z <= -10) opacity = Math.max(0, (z + 30) / 20);

        const dist = Math.sqrt(x * x + y * y);
        const distR = Math.min(dist / R, 1);
        const centerScale = Math.max(0.3, 1 - distR * 0.7);
        const depthScale = (z + R) / (2 * R);
        const scale = centerScale * Math.max(0.5, 0.8 + depthScale * 0.3);
        const sz = imgSize * scale;

        el.style.width = `${sz}px`;
        el.style.height = `${sz}px`;
        el.style.left = `${half + x}px`;
        el.style.top = `${half + y}px`;
        el.style.opacity = String(opacity);
        el.style.zIndex = String(Math.round(1000 + z));
      }

      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [spherePositions, containerSize, R, imgSize, momentumDecay, autoRotate, autoRotateSpeed, maxRotationSpeed]);

  // ── Mouse handlers ─────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      const rx = Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, -dy * dragSensitivity));
      const ry = Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, dx * dragSensitivity));
      rotRef.current.x = normAngle(rotRef.current.x + rx);
      rotRef.current.y = normAngle(rotRef.current.y + ry);
      velRef.current = { x: rx, y: ry };
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { draggingRef.current = false; };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragSensitivity, maxRotationSpeed]);

  // ── Touch handlers — NO preventDefault, scrolling works ────────
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - lastMouse.current.x;
      const dy = touch.clientY - lastMouse.current.y;
      const rx = Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, -dy * dragSensitivity));
      const ry = Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, dx * dragSensitivity));
      rotRef.current.x = normAngle(rotRef.current.x + rx);
      rotRef.current.y = normAngle(rotRef.current.y + ry);
      velRef.current = { x: rx, y: ry };
      lastMouse.current = { x: touch.clientX, y: touch.clientY };
    };
    const onTouchEnd = () => { draggingRef.current = false; };

    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [dragSensitivity, maxRotationSpeed]);

  // ── Render ──────────────────────────────────────────────────────
  if (!images.length) {
    return (
      <div
        style={{
          width: containerSize,
          height: containerSize,
          border: "2px dashed rgba(244,239,228,0.2)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(244,239,228,0.4)",
        }}
      >
        Aucune image
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes sphereFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sphereScaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .sphere-item {
          position: absolute;
          will-change: transform, left, top, width, height, opacity;
          cursor: pointer;
          transition: opacity 0.15s;
          visibility: hidden;
        }
        .sphere-item-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          border: 2px solid rgba(244,239,228,0.15);
          transition: transform 0.2s ease-out;
        }
        .sphere-item:hover .sphere-item-inner {
          transform: scale(1.15);
        }
        .sphere-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      `}</style>

      <div
        ref={containerRef}
        className={className}
        style={{
          width: containerSize,
          height: containerSize,
          position: "relative",
          perspective: `${perspective}px`,
          userSelect: "none",
          cursor: "grab",
          margin: "0 auto",
        }}
        onMouseDown={(e) => {
          draggingRef.current = true;
          velRef.current = { x: 0, y: 0 };
          lastMouse.current = { x: e.clientX, y: e.clientY };
        }}
        onTouchStart={(e) => {
          draggingRef.current = true;
          velRef.current = { x: 0, y: 0 };
          const t = e.touches[0];
          lastMouse.current = { x: t.clientX, y: t.clientY };
        }}
      >
        {spherePositions.map((_, i) => {
          const img = images[i];
          if (!img) return null;
          return (
            <div
              key={img.id}
              className="sphere-item"
              ref={(el) => { itemsRef.current[i] = el; }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() =>
                onImageClick ? onImageClick(img) : setSelected(img)
              }
            >
              <div className="sphere-item-inner">
                <img
                  src={img.src}
                  alt={img.alt}
                  draggable={false}
                  loading={i < 3 ? "eager" : "lazy"}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal spotlight */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            background: "rgba(0,0,0,0.6)",
            animation: "sphereFadeIn 0.25s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#12111b",
              borderRadius: 16,
              maxWidth: 420,
              width: "100%",
              overflow: "hidden",
              border: "1px solid rgba(244,239,228,0.15)",
              animation: "sphereScaleIn 0.25s ease-out",
            }}
          >
            <div style={{ position: "relative", aspectRatio: "1" }}>
              <img
                src={selected.src}
                alt={selected.alt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <button
                onClick={() => setSelected(null)}
                aria-label="Fermer"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 32,
                  height: 32,
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  borderRadius: "50%",
                  color: "#fff",
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
            {(selected.title || selected.description) && (
              <div style={{ padding: "1rem 1.25rem" }}>
                {selected.title && (
                  <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem", fontWeight: 700, color: "#f4efe4" }}>
                    {selected.title}
                  </h3>
                )}
                {selected.description && (
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(244,239,228,0.6)", lineHeight: 1.5 }}>
                    {selected.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
