import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const cleanUrl = url.split("?")[0];

  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`,
      { signal: AbortSignal.timeout(5_000) },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "TikTok oEmbed failed" }, { status: 502 });
    }

    const data = (await res.json()) as { html?: string; thumbnail_url?: string };

    return NextResponse.json({
      html: data.html ?? null,
      thumbnail_url: data.thumbnail_url ?? null,
    });
  } catch {
    return NextResponse.json({ error: "TikTok oEmbed timeout" }, { status: 504 });
  }
}
