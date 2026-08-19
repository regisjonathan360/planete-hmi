import fs from "node:fs/promises";
import path from "node:path";

const sharpEntry = process.env.SHARP_ENTRY || "sharp";
const { default: sharp } = await import(sharpEntry);

const sourceRoot = "C:/Users/regis/Downloads/Downloads";
const skinRoot = path.join(sourceRoot, "HMI_Snake_50_Skins");
const premiumRoot = path.join(sourceRoot, "slither_asset_pack_v2_premium");
const foodRoot = path.join(sourceRoot, "food image");
const pooSource = "C:/Users/regis/Downloads/poo_pile_emoticon_emoji_emo_icon_209639 (2).png";
const outputRoot = path.resolve("public/koule2d/skins");
const foodOutputRoot = path.resolve("public/koule2d/food");

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

const atlasConfig = {
  segment: { width: 64, height: 64, cols: 10 },
  head: { width: 96, height: 96, cols: 10 },
  tail: { width: 96, height: 96, cols: 10 },
};

const makeFrame = (x, y, width, height) => ({
  frame: { x, y, w: width, h: height },
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w: width, h: height },
  sourceSize: { w: width, h: height },
});

const colorDistance = (r, g, b, reference) => Math.sqrt(
  ((r - reference[0]) ** 2) +
  ((g - reference[1]) ** 2) +
  ((b - reference[2]) ** 2),
);

// Remove only background pixels connected to the image border. This keeps
// white parts inside logos intact while removing white/black/green source
// backgrounds from raster exports.
const removeEdgeBackground = (raw, width, height, mode) => {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;
  const reference = [raw[0], raw[1], raw[2]];

  const isBackground = (pixel) => {
    const offset = pixel * 4;
    if (raw[offset + 3] === 0) return true;
    const r = raw[offset];
    const g = raw[offset + 1];
    const b = raw[offset + 2];
    if (mode === "white") return r > 220 && g > 220 && b > 220 && Math.max(r, g, b) - Math.min(r, g, b) < 32;
    if (mode === "black") return r < 52 && g < 52 && b < 52;
    return colorDistance(r, g, b, reference) < 62;
  };

  const enqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixel = (y * width) + x;
    if (visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    queue[queueEnd] = pixel;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueStart < queueEnd) {
    const pixel = queue[queueStart];
    queueStart += 1;
    raw[(pixel * 4) + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }
};

const writeFoodWebp = async (source, target, backgroundMode) => {
  const pipeline = sharp(await fs.readFile(source), { density: 144 })
    .resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha();

  if (!backgroundMode) {
    await pipeline.webp({ quality: 80, effort: 6, alphaQuality: 88 }).toFile(target);
    return;
  }

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  removeEdgeBackground(data, info.width, info.height, backgroundMode);
  await sharp(data, { raw: info })
    .webp({ quality: 80, effort: 6, alphaQuality: 88 })
    .toFile(target);
};

await ensureDir(outputRoot);
await ensureDir(foodOutputRoot);

const sourceSkins = await readJson(path.join(skinRoot, "skins.json"));
const premiumPalettes = [
  ["#19E6FF", "#075BFF", "#A7F3FF", "#FFFFFF"],
  ["#B45CFF", "#5B20D6", "#FF2BD6", "#FFF3FF"],
  ["#C7FF2E", "#48B600", "#00A77B", "#FDFFE8"],
  ["#FFE66D", "#F04A00", "#8A2BE2", "#FFF8C9"],
  ["#FF65D8", "#FF168C", "#7A00FF", "#FFF0FB"],
  ["#FFFFFF", "#B7D7FF", "#6E9DFF", "#FFFFFF"],
  ["#FF4D6D", "#C91535", "#5A0014", "#FFF1F3"],
  ["#343A52", "#111318", "#7B5CFF", "#F4F0FF"],
];
const premiumNames = [
  "Cyber Cyan", "Plasma Purple", "Neon Lime", "Inferno Gold",
  "Hot Magenta", "Ice White", "Crimson", "Void",
];
const premiumSkins = premiumNames.map((name, index) => {
  const number = String(index + 1).padStart(2, "0");
  const slug = name.toLowerCase().replace(/\s+/g, "_");
  return {
    id: `premium_${number}_${slug}`,
    name: `${name} · Premium`,
    palette: premiumPalettes[index],
    rarity: "premium",
    premiumAssets: {
      body: `snakes/bodies/body_${number}_${slug}.svg`,
      head: `snakes/heads/head_${number}_${slug}.svg`,
      tail: `snakes/tails/tail_${number}_${slug}.svg`,
    },
  };
});
const allSkins = [...sourceSkins, ...premiumSkins];
const catalogs = [];

for (const skin of allSkins) {
  catalogs.push({
    id: skin.id,
    name: skin.name,
    frame: skin.id,
    palette: skin.palette,
    rarity: skin.rarity || (Number(skin.id.slice(0, 2)) <= 5 ? "rare" : Number(skin.id.slice(0, 2)) >= 46 ? "legendary" : "standard"),
  });
  for (const part of ["body", "head", "tail"]) {
    const source = skin.premiumAssets
      ? path.join(premiumRoot, skin.premiumAssets[part])
      : path.join(skinRoot, skin.id, `${part}.svg`);
    const target = path.join(outputRoot, `${skin.id}-${part}.webp`);
    let image = sharp(await fs.readFile(source), { density: 144 });
    if (part === "body" && !skin.premiumAssets) {
      image = image.resize(256, 128).extract({ left: 0, top: 32, width: 64, height: 64 });
    } else if (part === "body") {
      image = image.resize(64, 64);
    } else {
      image = image.resize(96, 96);
    }
    await image.webp({ quality: 78, effort: 6, alphaQuality: 85 }).toFile(target);
  }
}

await fs.writeFile(path.join(outputRoot, "skin-catalog.json"), JSON.stringify(catalogs, null, 2));

for (const [type, config] of Object.entries(atlasConfig)) {
  const frames = {};
  const composites = [];
  const rows = Math.ceil(allSkins.length / config.cols);
  for (let index = 0; index < allSkins.length; index += 1) {
    const skin = allSkins[index];
    const x = (index % config.cols) * config.width;
    const y = Math.floor(index / config.cols) * config.height;
    const input = path.join(outputRoot, `${skin.id}-${type === "segment" ? "body" : type}.webp`);
    composites.push({ input, left: x, top: y });
    frames[skin.id] = makeFrame(x, y, config.width, config.height);
  }
  const atlasPath = path.join(outputRoot, `skin-${type}.webp`);
  await sharp({
    create: {
      width: config.cols * config.width,
      height: rows * config.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ quality: 78, effort: 6, alphaQuality: 85 })
    .toFile(atlasPath);
  await fs.writeFile(path.join(outputRoot, `skin-${type}.json`), JSON.stringify({
    frames,
    meta: {
      app: "Planète HMI Snake",
      image: `skin-${type}.webp`,
      format: "RGBA8888",
      size: { w: config.cols * config.width, h: rows * config.height },
      scale: "1",
    },
  }, null, 2));
}

const foodSources = {
  // The white-background PNG is easier to clean than the checkerboard export.
  "food-spotify-real": "spotify.png",
  "food-deezer-real": "Deezer Icon Logo Vector.svg",
  "food-tiktok-real": "tiktok-seeklogo.png",
  "food-audiomack-real": "icons8-audiomack.svg",
  "food-flame-red-real": "iconflamered.png",
  "food-flame-blue-real": "iconflameblue.png",
  "food-music-real": "icons8-music-48.png",
  "food-waste-real": pooSource,
};

const foodBackgroundModes = {
  "food-spotify-real": "white",
  "food-tiktok-real": "corner",
  "food-flame-red-real": "black",
  "food-flame-blue-real": "black",
};

for (const [name, file] of Object.entries(foodSources)) {
  const source = name === "food-waste-real" ? file : path.join(foodRoot, file);
  await writeFoodWebp(source, path.join(foodOutputRoot, `${name}.webp`), foodBackgroundModes[name]);
}

await fs.writeFile(path.join(foodOutputRoot, "food-catalog.json"), JSON.stringify([
  { id: "hmi", label: "Planète HMI", asset: "/brand/icon-192x192.png", source: "project" },
  { id: "spotify", label: "Spotify", asset: "/koule2d/food/food-spotify-real.webp", source: "provided" },
  { id: "audiomack", label: "Audiomack", asset: "/koule2d/food/food-audiomack-real.webp", source: "provided" },
  { id: "deezer", label: "Deezer", asset: "/koule2d/food/food-deezer-real.webp", source: "provided" },
  { id: "tiktok", label: "TikTok", asset: "/koule2d/food/food-tiktok-real.webp", source: "provided" },
  { id: "flame-red", label: "Flamme rouge", asset: "/koule2d/food/food-flame-red-real.webp", source: "provided" },
  { id: "flame-blue", label: "Flamme bleue", asset: "/koule2d/food/food-flame-blue-real.webp", source: "provided" },
  { id: "waste", label: "Déjection", asset: "/koule2d/food/food-waste-real.webp", source: "provided" },
], null, 2));

console.log(`Optimized ${allSkins.length} skins and ${Object.keys(foodSources).length} food assets.`);
