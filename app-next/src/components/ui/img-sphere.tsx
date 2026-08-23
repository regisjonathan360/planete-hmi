"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

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
  const [mounted, setMounted] = useState(false);
  const [rotation, setRotation] = useState({ x: 15, y: 15 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<ImageData | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [positions, setPositions] = useState<
    { theta: number; phi: number }[]
  >([]);

  const ref = useRef<HTMLDivElement>(null);
  const lastMouse = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);

  const R = sphereRadius || containerSize * 0.5;
  const imgSize = containerSize * baseImageScale;

  // ── Generate sphere positions (Fibonacci) ──────────────────────
  const genPositions = useCallback(() => {
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

  useEffect(() => {
    setPositions(genPositions());
  }, [genPositions]);

  // ── Calculate world positions ───────────────────────────────────
  const calcWorld = useCallback(() => {
    return positions.map((pos, idx) => {
      const tR = deg2rad(pos.theta);
      const pR = deg2rad(pos.phi);
      const rxR = deg2rad(rotation.x);
      const ryR = deg2rad(rotation.y);

      let x = R * Math.sin(pR) * Math.cos(tR);
      let y = R * Math.cos(pR);
      let z = R * Math.sin(pR) * Math.sin(tR);

      // Y rotation
      const x1 = x * Math.cos(ryR) + z * Math.sin(ryR);
      const z1 = -x * Math.sin(ryR) + z * Math.cos(ryR);
      x = x1;
      z = z1;

      // X rotation
      const y2 = y * Math.cos(rxR) - z * Math.sin(rxR);
      const z2 = y * Math.sin(rxR) + z * Math.cos(rxR);
      y = y2;
      z = z2;

      const visible = z > -30;
      let opacity = 1;
      if (z <= -10) opacity = Math.max(0, (z + 30) / 20);

      const dist = Math.sqrt(x * x + y * y);
      const distR = Math.min(dist / R, 1);
      const centerScale = Math.max(0.3, 1 - distR * 0.7);
      const depthScale = (z + R) / (2 * R);
      const scale = centerScale * Math.max(0.5, 0.8 + depthScale * 0.3);

      return {
        x,
        y,
        z,
        scale,
        zIndex: Math.round(1000 + z),
        visible,
        opacity,
        idx,
      };
    });
  }, [positions, rotation, R]);

  // ── Momentum animation loop ────────────────────────────────────
  const update = useCallback(() => {
    if (dragging) return;
    setVelocity((v) => {
      const nx = v.x * momentumDecay;
      const ny = v.y * momentumDecay;
      if (!autoRotate && Math.abs(nx) < 0.01 && Math.abs(ny) < 0.01)
        return { x: 0, y: 0 };
      return { x: nx, y: ny };
    });
    setRotation((prev) => {
      let ny = prev.y;
      if (autoRotate) ny += autoRotateSpeed;
      ny += Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, velocity.y));
      return {
        x: normAngle(
          prev.x +
            Math.max(
              -maxRotationSpeed,
              Math.min(maxRotationSpeed, velocity.x)
            )
        ),
        y: normAngle(ny),
      };
    });
  }, [dragging, momentumDecay, velocity, autoRotate, autoRotateSpeed, maxRotationSpeed]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const loop = () => {
      update();
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [mounted, update]);

  // ── Mouse / touch handlers ─────────────────────────────────────
  const clamp = (s: number) =>
    Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, s));

  const onDown = useCallback(
    (cx: number, cy: number) => {
      setDragging(true);
      setVelocity({ x: 0, y: 0 });
      lastMouse.current = { x: cx, y: cy };
    },
    []
  );

  const onMove = useCallback(
    (cx: number, cy: number) => {
      if (!dragging) return;
      const dx = cx - lastMouse.current.x;
      const dy = cy - lastMouse.current.y;
      const rx = clamp(-dy * dragSensitivity);
      const ry = clamp(dx * dragSensitivity);
      setRotation((p) => ({ x: normAngle(p.x + rx), y: normAngle(p.y + ry) }));
      setVelocity({ x: rx, y: ry });
      lastMouse.current = { x: cx, y: cy };
    },
    [dragging, dragSensitivity, clamp]
  );

  const onUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (!mounted) return;
    const mMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const mUp = () => onUp();
    const tMove = (e: TouchEvent) => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const tEnd = () => onUp();
    document.addEventListener("mousemove", mMove);
    document.addEventListener("mouseup", mUp);
    document.addEventListener("touchmove", tMove, { passive: false });
    document.addEventListener("touchend", tEnd);
    return () => {
      document.removeEventListener("mousemove", mMove);
      document.removeEventListener("mouseup", mUp);
      document.removeEventListener("touchmove", tMove);
      document.removeEventListener("touchend", tEnd);
    };
  }, [mounted, onMove, onUp]);

  // ── Render ──────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div
        style={{
          width: containerSize,
          height: containerSize,
          background: "rgba(18,17,27,0.3)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(244,239,228,0.4)",
        }}
      >
        Chargement…
      </div>
    );
  }

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

  const world = calcWorld();

  return (
    <>
      <style>{`
        @keyframes sphereFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sphereScaleIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <div
        ref={ref}
        className={className}
        style={{
          width: containerSize,
          height: containerSize,
          position: "relative",
          perspective: `${perspective}px`,
          userSelect: "none",
          cursor: dragging ? "grabbing" : "grab",
          margin: "0 auto",
        }}
        onMouseDown={(e) => onDown(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          e.preventDefault();
          onDown(e.touches[0].clientX, e.touches[0].clientY);
        }}
      >
        {world.map((pos) => {
          if (!pos.visible) return null;
          const img = images[pos.idx];
          if (!img) return null;
          const sz = imgSize * pos.scale;
          const isH = hovered === pos.idx;
          return (
            <div
              key={img.id}
              style={{
                position: "absolute",
                width: sz,
                height: sz,
                left: containerSize / 2 + pos.x,
                top: containerSize / 2 + pos.y,
                opacity: pos.opacity,
                transform: `translate(-50%, -50%) scale(${isH ? Math.min(1.2, 1.2 / pos.scale) : 1})`,
                zIndex: pos.zIndex,
                transition: "transform 0.2s ease-out",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHovered(pos.idx)}
              onMouseLeave={() => setHovered(null)}
              onClick={() =>
                onImageClick ? onImageClick(img) : setSelected(img)
              }
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  border: "2px solid rgba(244,239,228,0.15)",
                }}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  draggable={false}
                  loading={pos.idx < 3 ? "eager" : "lazy"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
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
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
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
                  <h3
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "#f4efe4",
                    }}
                  >
                    {selected.title}
                  </h3>
                )}
                {selected.description && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.88rem",
                      color: "rgba(244,239,228,0.6)",
                      lineHeight: 1.5,
                    }}
                  >
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
