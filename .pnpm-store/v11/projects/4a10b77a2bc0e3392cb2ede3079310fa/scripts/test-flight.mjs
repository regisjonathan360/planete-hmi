// Test: extract all tracks from /top/songs?country=haiti Flight payload
const url = "https://audiomack.com/top/songs?country=haiti";
const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html",
  },
});
const html = await res.text();
console.log(`Page: ${html.length} chars`);

// Extract flight text (decode escaped strings from self.__next_f.push)
const PUSH = "self.__next_f.push(";
const chunks = [];
let from = 0;
while (from < html.length) {
  const start = html.indexOf(PUSH, from);
  if (start === -1) break;
  const argStart = start + PUSH.length;
  let depth = 1, i = argStart, inStr = false, esc = false;
  for (; i < html.length && depth > 0; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
    else { if (c === '"') inStr = true; else if (c === "(") depth++; else if (c === ")") depth--; }
  }
  const argStr = html.slice(argStart, i - 1);
  try {
    const parsed = JSON.parse(argStr);
    if (Array.isArray(parsed)) parsed.forEach(p => { if (typeof p === "string") chunks.push(p); });
  } catch {}
  from = i;
}
const flight = chunks.join("");
console.log(`Flight text: ${flight.length} chars`);

// Find individual track objects - the data is a flat sequence of JSON objects
// Each track has: "title":"...", "artist":"...", "rank_data":{"rank":N}
// They appear as individual objects in the flight text, separated by commas
// Let's find all objects with rank_data

// Strategy: find each "rank_data":{"rank":N} and then look backwards for title and artist
const rankPattern = /"rank_data":\{"rank":(\d+)/g;
let m;
const trackPositions = [];
while ((m = rankPattern.exec(flight)) !== null) {
  trackPositions.push({ index: m.index, rank: parseInt(m[1]) });
}
console.log(`rank_data occurrences: ${trackPositions.length}`);

// For each rank, look backwards in the text to find the enclosing object's title and artist
const tracks = [];
for (const pos of trackPositions) {
  // Search backwards from rank_data to find title and artist
  const contextStart = Math.max(0, pos.index - 3000);
  const context = flight.slice(contextStart, pos.index + 50);
  
  const titleMatch = context.match(/"title":"([^"]+)"/);
  const artistMatch = context.match(/"artist":"([^"]+)"/);
  const imageMatch = context.match(/"image":"([^"]+)"/);
  const urlMatch = context.match(/"url_slug":"([^"]+)"/);
  const genreMatch = context.match(/"genre":"([^"]+)"/);
  const albumMatch = context.match(/"album":"([^"]*?)"/);
  
  if (titleMatch && artistMatch) {
    tracks.push({
      rank: pos.rank,
      title: titleMatch[1],
      artist: artistMatch[1],
      image: imageMatch ? imageMatch[1] : null,
      url_slug: urlMatch ? urlMatch[1] : null,
      genre: genreMatch ? genreMatch[1] : null,
      album: albumMatch ? albumMatch[1] : null,
    });
  }
}

tracks.sort((a, b) => a.rank - b.rank);
console.log(`\nTotal tracks found: ${tracks.length}`);
tracks.slice(0, 5).forEach(t => console.log(`  #${t.rank}: ${t.artist} - ${t.title}`));
console.log("  ...");
tracks.slice(-3).forEach(t => console.log(`  #${t.rank}: ${t.artist} - ${t.title}`));
