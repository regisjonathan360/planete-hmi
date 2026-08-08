"use client";

import { useEffect, useRef } from "react";
import { artistAvatarSrc } from "@/lib/artists/avatar";

interface BirthdayArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  isToday: boolean;
  daysUntil: number;
}

interface BirthdayPlanetProps {
  artists: BirthdayArtist[];
}

export function BirthdayPlanet({ artists }: BirthdayPlanetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || artists.length === 0) return;

    // Configuration initiale
    let animationId: number | null = null;
    
    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const size = Math.min(rect.width, 500);
      
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      return { size, dpr };
    };

    const { size, dpr } = setupCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const planetRadius = size * 0.15;
    const orbitRadius = planetRadius + size * 0.08;
    const avatarRadius = planetRadius * 0.25;
    const rotationSpeed = 0.002;

    let rotationAngle = 0;
    const avatarImages: Record<string, HTMLImageElement> = {};
    let imagesLoaded = 0;

    // Charger les images
    const loadImages = () => {
      artists.forEach((artist) => {
        if (artist.imageUrl) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            avatarImages[artist.id] = img;
            imagesLoaded++;
          };
          img.onerror = () => {
            imagesLoaded++;
          };
          img.src = artistAvatarSrc(artist.imageUrl);
        } else {
          imagesLoaded++;
        }
      });
    };

    const drawCakeTexture = () => {
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, planetRadius * 1.1);
      gradient.addColorStop(0, "#22c55e");
      gradient.addColorStop(0.5, "#16a34a");
      gradient.addColorStop(1, "#14532d");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, planetRadius, 0, Math.PI * 2);
      ctx.fill();

      // Bougies
      const numCandles = 10;
      for (let i = 0; i < numCandles; i++) {
        const angle = (i / numCandles) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * (planetRadius * 0.75);
        const y = centerY + Math.sin(angle) * (planetRadius * 0.75);

        const candleColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"];
        const color = candleColors[i % candleColors.length];

        ctx.fillStyle = color;
        ctx.fillRect(x - 2, y - 8, 4, 10);

        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(x, y - 10, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(251, 191, 36, 0.4)";
        ctx.beginPath();
        ctx.arc(x, y - 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Confettis
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * planetRadius * 0.6;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    };

    const drawOrbit = () => {
      artists.forEach((artist, i) => {
        const angle = rotationAngle + (i / artists.length) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius;

        ctx.save();
        ctx.translate(x, y);

        ctx.fillStyle = "#1a1028";
        ctx.beginPath();
        ctx.arc(0, 0, avatarRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(244, 239, 228, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const avatar = avatarImages[artist.id];
        if (avatar) {
          ctx.beginPath();
          ctx.arc(0, 0, avatarRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatar, -avatarRadius, -avatarRadius, avatarRadius * 2, avatarRadius * 2);
        } else {
          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 8px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(artist.name[0] || "?", 0, 0);
        }

        ctx.restore();
        ctx.save();
        ctx.translate(x, y - avatarRadius - 20);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const displayName = artist.name.length > 10 ? artist.name.substring(0, 9) + "." : artist.name;
        ctx.fillText(displayName, 0, 0);

        if (artist.isToday) {
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(-18, 8, 36, 10);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 8px Inter, sans-serif";
          ctx.fillText("TODAY", 0, 13);
        }

        ctx.restore();
      });
    };

    const drawOrbitRing = () => {
      ctx.save();
      ctx.strokeStyle = "rgba(244, 239, 228, 0.12)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbitRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    const animate = () => {
      // Remplir le fond
      ctx.fillStyle = "rgba(8, 7, 13, 0.95)";
      ctx.fillRect(0, 0, size, size);

      drawCakeTexture();
      drawOrbitRing();
      drawOrbit();

      rotationAngle += rotationSpeed;
      animationId = requestAnimationFrame(animate);
    };

    loadImages();
    
    // Attendre que les images se chargent, puis démarrer
    const checkAndStart = () => {
      if (imagesLoaded === artists.length) {
        animate();
      } else {
        setTimeout(checkAndStart, 50);
      }
    };
    
    setTimeout(checkAndStart, 100);

    const handleResize = () => {
      setupCanvas();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [artists]);

  return (
    <div
      className="birthday-planet"
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth: 500,
        aspectRatio: "1 / 1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto",
        background: "rgba(8, 7, 13, 0.5)",
        borderRadius: "16px",
        border: "1px solid rgba(244, 239, 228, 0.1)",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
        aria-label="Planète gâteau avec les anniversaires des artistes"
      />
    </div>
  );
}
