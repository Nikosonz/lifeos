/**
 * Generates the landing's static brand assets. Run by hand, output is
 * committed:
 *
 *   node apps/web/scripts/generate-brand-assets.mjs      (from the repo root)
 *
 *   public/favicon.ico         32x32   the path browsers request unasked
 *   src/app/icon.png          512x512  browser tab / PWA
 *   src/app/apple-icon.png    180x180  iOS home screen
 *   public/og-fa.png         1200x630  link preview, Persian
 *   public/og-en.png         1200x630  link preview, English
 *
 * WHY CHROMIUM AND NOT next/og. Satori (what ImageResponse renders with)
 * does not do Arabic-script shaping: Persian comes out as disconnected
 * letters in visual order, which on a link preview is worse than no image.
 * Chromium shapes it correctly because it is a browser. @playwright/test is
 * already a devDependency here for the e2e suite, so this adds nothing to
 * install.
 *
 * WHY TWO OG FILES RATHER THAN app/[locale]/opengraph-image. A dynamic
 * route segment cannot hold two different static images, and the Persian
 * and English cards must differ — they are the page's own headline. Static
 * files referenced from generateMetadata is the only shape that gives both
 * locales a real card.
 *
 * ⚠️ public/ is NOT copied into .next/standalone by Next's minimal server —
 * apps/web/Dockerfile copies it explicitly. If these images 404 in
 * production while working in dev, that COPY line is what went missing.
 *
 * Fonts are inlined as data URIs from node_modules and src/assets so the
 * render never touches the network — this machine's access to Google-adjacent
 * hosts is documented as unreliable (see CLAUDE.md), and a silently
 * unstyled fallback font would ship as a committed asset.
 */
import { chromium } from "@playwright/test";
// Explicit import rather than the global: eslint's config for this repo
// does not declare Node globals for .mjs scripts, and an import is correct
// either way.
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(WEB, "../..");

// Sourced from globals.css: --brand-lapis / --brand-paper / --brand-turquoise
// converted from OKLCH to sRGB. These are baked pixels, so they are hex here
// by necessity — if the tokens move, re-run this script.
const LAPIS = "#1e4798";
const PAPER = "#f8fdfd";
const TURQUOISE = "#39bab4";
const INK = "#2e2e2e";
const MUTED = "#636363";

function dataUri(file) {
  return `data:font/woff2;base64,${fs.readFileSync(file).toString("base64")}`;
}

const FONTS = {
  lalezarArabic: dataUri(
    path.join(REPO, "node_modules/@fontsource/lalezar/files/lalezar-arabic-400-normal.woff2"),
  ),
  lalezarLatin: dataUri(
    path.join(REPO, "node_modules/@fontsource/lalezar/files/lalezar-latin-400-normal.woff2"),
  ),
  vazirRegular: dataUri(path.join(WEB, "src/assets/fonts/vazirmatn/Vazirmatn-Regular.woff2")),
  vazirSemiBold: dataUri(path.join(WEB, "src/assets/fonts/vazirmatn/Vazirmatn-SemiBold.woff2")),
};

// The girih 8-pointed star: two overlapped squares, one rotated 45°. Same
// shape as GirihStar in app/[locale]/page.tsx and the Android launcher icon
// (mobile/assets/icon/), which is why it is redrawn here rather than a new
// mark being invented.
function girihStar({ stroke, strokeWidth = 1.5 }) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="14" height="14" />
    <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
  </svg>`;
}

const FONT_FACES = `
  @font-face { font-family: Lalezar; src: url(${FONTS.lalezarArabic}) format('woff2'); unicode-range: U+0600-06FF, U+200C-200E, U+2010-2011, U+FB8A, U+FBFC-FBFD; }
  @font-face { font-family: Lalezar; src: url(${FONTS.lalezarLatin}) format('woff2'); unicode-range: U+0000-00FF, U+2000-206F; }
  @font-face { font-family: Vazirmatn; src: url(${FONTS.vazirRegular}) format('woff2'); font-weight: 400; }
  @font-face { font-family: Vazirmatn; src: url(${FONTS.vazirSemiBold}) format('woff2'); font-weight: 600; }
`;

function iconHtml(size) {
  // Full-bleed lapis with the star knocked out in paper, matching the
  // Android launcher icon so a tab and a home screen read as one product.
  const inset = size * 0.19;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${size}px;height:${size}px}
    body{background:${LAPIS};display:flex;align-items:center;justify-content:center}
    svg{width:${size - inset * 2}px;height:${size - inset * 2}px}
  </style></head><body>${girihStar({ stroke: PAPER, strokeWidth: 1.4 })}</body></html>`;
}

function ogHtml({ locale, brand, title, subtitle, chips }) {
  const rtl = locale === "fa";
  // Lalezar first, Vazirmatn behind it: Lalezar has no glyphs for some of
  // the punctuation the headline uses, and a missing glyph must fall back
  // to the body face rather than to a system font.
  const display = "Lalezar, Vazirmatn";
  return `<!doctype html><html lang="${locale}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>
    ${FONT_FACES}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:1200px;height:630px}
    body{
      background:${PAPER};
      font-family:Vazirmatn,system-ui,sans-serif;
      color:${INK};
      display:flex;flex-direction:column;justify-content:space-between;
      padding:72px 80px;
      position:relative;overflow:hidden;
    }
    /* The same girih tile as the page's hero backdrop, at the same weight. */
    .bg{
      position:absolute;inset:0;opacity:.06;
      background-image:url("data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='112' height='112'><g fill='none' stroke='${LAPIS}' stroke-width='1'><rect x='28' y='28' width='56' height='56'/><rect x='28' y='28' width='56' height='56' transform='rotate(45 56 56)'/></g></svg>`,
      )}");
    }
    .row{position:relative;display:flex;align-items:center;gap:18px}
    .star{width:46px;height:46px;flex:none}
    .brand{font-family:${display};font-size:46px;line-height:1;color:${LAPIS}}
    h1{
      position:relative;font-family:${display};font-weight:400;
      font-size:${rtl ? 78 : 72}px;line-height:1.12;max-width:960px;color:${INK};
    }
    p{position:relative;font-size:29px;line-height:1.55;color:${MUTED};max-width:930px;margin-top:22px}
    .chips{position:relative;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
    .chip{
      border:2px solid ${TURQUOISE}55;background:${TURQUOISE}18;
      border-radius:999px;padding:9px 22px;font-size:24px;color:#00706b;font-weight:600;
    }
    .url{position:relative;font-size:25px;color:${LAPIS};font-weight:600;direction:ltr;margin-inline-start:auto}
    .foot{position:relative;display:flex;align-items:center;gap:18px}
  </style></head><body>
    <div class="bg"></div>
    <div class="row"><span class="star">${girihStar({ stroke: LAPIS, strokeWidth: 1.6 })}</span><span class="brand">${brand}</span></div>
    <div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="foot">
      <div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
      <span class="url">maaleto.ir</span>
    </div>
  </body></html>`;
}

const messages = {
  fa: JSON.parse(fs.readFileSync(path.join(WEB, "src/messages/fa.json"), "utf8")).Landing,
  en: JSON.parse(fs.readFileSync(path.join(WEB, "src/messages/en.json"), "utf8")).Landing,
};

const CARDS = {
  fa: {
    locale: "fa",
    brand: "مال تو",
    title: messages.fa.title,
    // Not metaDescription: that is written for a SERP snippet and is far
    // too long for a card. The card gets the promise, the chips get the
    // proof.
    subtitle: "مالی، کارها، تقویم، عادت‌ها و گزارش‌ها — رایگان، روی وب و اندروید.",
    chips: [
      messages.fa.proofJalaliTitle,
      messages.fa.proofTomanTitle,
      messages.fa.proofSaturdayTitle,
    ],
  },
  en: {
    locale: "en",
    brand: "maaleto",
    title: messages.en.title,
    subtitle: "Finance, tasks, calendar, habits and reports — free, on web and Android.",
    chips: [
      messages.en.proofJalaliTitle,
      messages.en.proofTomanTitle,
      messages.en.proofSaturdayTitle,
    ],
  },
};

/**
 * Wraps a 32x32 PNG in an ICO container. Browsers request /favicon.ico at
 * the origin root whether or not a <link> points there, so without this
 * file every first visit takes a 404. A single-image ICO is a 6-byte
 * ICONDIR, a 16-byte ICONDIRENTRY and the PNG payload verbatim — PNG-in-ICO
 * has been supported since Vista and is what every modern generator emits.
 */
function pngToIco(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt8(0, 8); // palette size: not paletted
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // payload offset
  return Buffer.concat([header, png]);
}

async function shoot(page, html, { width, height, out }) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  // Inlined data-URI faces still resolve asynchronously; without this the
  // first render can land on the fallback and bake it into the PNG.
  // Runs in the page, not in Node — hence the disable; eslint has no way to
  // know which side of the bridge this callback is serialized to.
  // eslint-disable-next-line no-undef
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: "png" });
  console.log("wrote", path.relative(REPO, out), `(${width}x${height})`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

await shoot(page, iconHtml(512), {
  width: 512,
  height: 512,
  out: path.join(WEB, "src/app/icon.png"),
});
await shoot(page, iconHtml(180), {
  width: 180,
  height: 180,
  out: path.join(WEB, "src/app/apple-icon.png"),
});
// 32px is the size a tab strip and a bookmark bar actually draw; the star
// has no fine detail to lose at that scale.
//
// ⚠️ It goes in public/, NOT app/. Next's build decodes an app/favicon.ico
// with the Rust `image` crate, whose ICO decoder accepts only RGBA payloads
// — "Format error decoding Ico: The PNG is not in RGBA format!", a hard
// build failure. Chromium encodes a fully opaque page as RGB and drops the
// alpha channel even with omitBackground set, so there is no screenshot flag
// that satisfies it. Files under public/ are served verbatim and never
// decoded, which sidesteps the constraint entirely and costs nothing: the
// <link rel="icon"> tags come from the layout's metadata.icons either way.
const faviconPng = await page
  .setViewportSize({ width: 32, height: 32 })
  .then(() => page.setContent(iconHtml(32), { waitUntil: "load" }))
  .then(() => page.screenshot({ type: "png" }));
fs.mkdirSync(path.join(WEB, "public"), { recursive: true });
fs.writeFileSync(path.join(WEB, "public/favicon.ico"), pngToIco(faviconPng, 32));
console.log("wrote apps/web/public/favicon.ico (32x32)");

for (const card of Object.values(CARDS)) {
  await shoot(page, ogHtml(card), {
    width: 1200,
    height: 630,
    out: path.join(WEB, `public/og-${card.locale}.png`),
  });
}

await browser.close();
