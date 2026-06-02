import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { webcrypto } from "node:crypto";

const PASSWORD = process.env.ADMIN_PASSWORD;
const SOURCE = resolve(process.argv[2] || "C:/Users/Administrator/Downloads/nerve_pricing.html");
const OUTPUT = resolve(process.argv[3] || "admin/payload.js");
const ITERATIONS = Number(process.env.ADMIN_PBKDF2_ITERATIONS || 600000);

if (!PASSWORD) {
  throw new Error("Set ADMIN_PASSWORD before running this script.");
}

const { subtle } = webcrypto;
const encoder = new TextEncoder();

const bytesToBase64 = (bytes) => Buffer.from(bytes).toString("base64");

const extract = (source, pattern, label) => {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Could not extract ${label} from ${SOURCE}.`);
  }
  return match[1].trim();
};

const sourceHtml = await readFile(SOURCE, "utf8");
const body = extract(sourceHtml, /<body[^>]*>([\s\S]*?)<\/body>/i, "body");
const pricingMarkup = body.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
const pricingScript = extract(body, /<script[^>]*>([\s\S]*?)<\/script>/i, "script");

const cleanedMarkup = pricingMarkup
  .replace(/<header[\s\S]*?<\/header>/i, "")
  .replace(
    /<p style="font-size:13px; color:#888; margin-bottom:28px; line-height:1.6;">([\s\S]*?)<\/p>/i,
    '<p class="pricing-intro">$1</p>'
  )
  .replace("The plan builder on the right updates in real time.", "The plan builder updates in real time.")
  .trim();

const css = `
.pricing-tool {
  color: rgb(var(--theme-fg-rgb));
}

.pricing-tool .container {
  width: 100%;
  max-width: var(--max);
  margin: 0 auto;
  padding: 6px 0 48px;
}

.pricing-tool .grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 390px);
  gap: clamp(20px, 4vw, 42px);
  align-items: start;
}

.pricing-tool .section-label {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.pricing-tool h2 {
  margin: 0 0 12px;
  font-family: var(--display);
  font-size: clamp(3.2rem, 8vw, 6.8rem);
  font-weight: 400;
  line-height: 0.86;
  letter-spacing: 0;
  text-transform: uppercase;
}

.pricing-tool .pricing-intro {
  max-width: 620px;
  margin: 0 0 26px;
  color: var(--soft);
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.55;
}

.pricing-tool .rate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}

.pricing-tool .rate-card,
.pricing-tool .notes,
.pricing-tool .summary-box,
.pricing-tool .plan-builder {
  border: 1px solid var(--line);
  background: #e4e4dd;
  box-shadow: none;
  backdrop-filter: none;
}

.pricing-tool .rate-card {
  min-height: 156px;
  padding: 18px;
  transition: border-color 180ms ease, background 180ms ease;
}

.pricing-tool .rate-card:focus-within {
  border-color: rgba(0, 0, 0, 0.42);
  background: #deded6;
}

.pricing-tool .service-name,
.pricing-tool .row-unit,
.pricing-tool .discount-label,
.pricing-tool .summary-box h3,
.pricing-tool .final-label,
.pricing-tool .per-month {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pricing-tool .unit-label,
.pricing-tool .monthly-hint {
  color: rgba(var(--theme-fg-rgb), 0.52) !important;
  font-size: 0.76rem;
}

.pricing-tool .price-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.pricing-tool .currency {
  color: var(--muted);
  font-weight: 900;
}

.pricing-tool input {
  border-radius: 0;
  outline: none;
}

.pricing-tool .price-input {
  width: 110px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: rgb(var(--theme-fg-rgb));
  font-family: var(--display);
  font-size: 2.4rem;
  line-height: 1;
}

.pricing-tool .price-input:focus,
.pricing-tool .discount-input:focus {
  border-color: currentColor;
}

.pricing-tool .notes {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
  padding: 18px;
}

.pricing-tool .notes p {
  margin: 0;
  color: var(--soft);
  font-size: 0.9rem;
  line-height: 1.5;
}

.pricing-tool .summary-box {
  position: relative;
  padding: 18px;
}

.pricing-tool .summary-box h3 {
  margin: 0 0 12px;
  color: rgb(var(--theme-fg-rgb));
}

.pricing-tool #summary-text {
  min-height: 74px;
  white-space: pre-line;
  color: var(--soft);
  font-size: 0.92rem;
  line-height: 1.5;
}

.pricing-tool .copy-feedback {
  position: absolute;
  right: 14px;
  bottom: 12px;
  opacity: 0;
  color: rgb(var(--theme-fg-rgb));
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: opacity 180ms ease;
}

.pricing-tool .copy-feedback.show {
  opacity: 1;
}

.pricing-tool .plan-builder {
  position: sticky;
  top: 96px;
  padding: clamp(18px, 2vw, 22px);
}

.pricing-tool .plan-builder h2 {
  margin-bottom: 18px;
  font-size: clamp(2.8rem, 6vw, 4.4rem);
}

.pricing-tool .builder-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(60px, auto);
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--dark-line);
}

.pricing-tool .row-name {
  color: rgb(var(--theme-fg-rgb));
  font-weight: 900;
}

.pricing-tool .qty-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pricing-tool .qty-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  background: rgba(245, 245, 240, 0.26);
  color: rgb(var(--theme-fg-rgb));
  cursor: pointer;
  font-weight: 900;
}

.pricing-tool .qty-btn:hover,
.pricing-tool .qty-btn:focus-visible {
  border-color: currentColor;
  background: rgba(245, 245, 240, 0.42);
}

.pricing-tool .qty-val,
.pricing-tool .row-price,
.pricing-tool .subtotal-row .value,
.pricing-tool .final-value {
  font-family: var(--display);
  line-height: 1;
}

.pricing-tool .qty-val {
  min-width: 24px;
  font-size: 1.8rem;
  text-align: center;
}

.pricing-tool .row-price {
  min-width: 64px;
  font-size: 1.3rem;
  text-align: right;
}

.pricing-tool .totals-section {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.pricing-tool .subtotal-row,
.pricing-tool .discount-section,
.pricing-tool .final-row,
.pricing-tool .action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.pricing-tool .subtotal-row {
  margin-bottom: 16px;
}

.pricing-tool .subtotal-row .label {
  color: var(--soft);
  font-weight: 800;
}

.pricing-tool .subtotal-row .value {
  font-size: 1.9rem;
}

.pricing-tool .discount-section {
  flex-wrap: wrap;
  padding: 14px 0;
  border-top: 1px solid var(--dark-line);
  border-bottom: 1px solid var(--dark-line);
}

.pricing-tool .discount-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pricing-tool .discount-input {
  width: 58px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: rgb(var(--theme-fg-rgb));
  font: 900 1rem var(--body);
  text-align: right;
}

.pricing-tool .discount-pct,
.pricing-tool .discount-saved {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 900;
}

.pricing-tool .discount-saved.active {
  color: rgb(var(--theme-fg-rgb));
}

.pricing-tool .final-row {
  padding: 18px 0 16px;
}

.pricing-tool .final-value {
  font-size: 3.4rem;
}

.pricing-tool .action-row {
  align-items: stretch;
}

.pricing-tool .btn {
  flex: 1;
  min-height: 50px;
  border: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  color: rgb(var(--theme-fg-rgb));
  cursor: pointer;
  font: 900 0.72rem var(--body);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transition: border-color 180ms ease, background 180ms ease;
}

.pricing-tool .btn-primary {
  background: rgb(var(--theme-fg-rgb));
  color: rgb(var(--theme-bg-rgb));
}

.pricing-tool .btn:hover,
.pricing-tool .btn:focus-visible {
  border-color: currentColor;
  background: rgba(0, 0, 0, 0.08);
}

.pricing-tool .btn-primary:hover,
.pricing-tool .btn-primary:focus-visible {
  background: rgba(0, 0, 0, 0.82);
  color: #fff;
}

@media (max-width: 900px) {
  .pricing-tool .grid {
    grid-template-columns: 1fr;
  }

  .pricing-tool .plan-builder {
    position: static;
  }
}

@media (max-width: 620px) {
  .pricing-tool .container {
    padding-top: 0;
    padding-bottom: 28px;
  }

  .pricing-tool .rate-grid {
    grid-template-columns: 1fr;
  }

  .pricing-tool .rate-card {
    min-height: 0;
    padding: 16px;
  }

  .pricing-tool .plan-builder,
  .pricing-tool .notes,
  .pricing-tool .summary-box {
    padding: 16px;
  }

  .pricing-tool h2 {
    font-size: clamp(3rem, 15vw, 4.7rem);
  }

  .pricing-tool .plan-builder h2 {
    font-size: clamp(2.8rem, 14vw, 4rem);
  }

  .pricing-tool .builder-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .pricing-tool .row-price {
    grid-column: 1 / -1;
    min-width: 0;
    text-align: left;
  }

  .pricing-tool .final-value {
    font-size: 2.8rem;
  }

  .pricing-tool .action-row {
    flex-direction: column;
  }
}
`;

const bundle = {
  html: `<div class="pricing-tool">${cleanedMarkup}</div>`,
  css,
  script: pricingScript,
};

const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const baseKey = await subtle.importKey("raw", encoder.encode(PASSWORD), "PBKDF2", false, ["deriveKey"]);
const key = await subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  baseKey,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"]
);
const ciphertext = new Uint8Array(
  await subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(bundle)))
);

const payload = {
  version: 1,
  algorithm: "AES-GCM",
  kdf: "PBKDF2-SHA-256",
  iterations: ITERATIONS,
  salt: bytesToBase64(salt),
  iv: bytesToBase64(iv),
  ciphertext: bytesToBase64(ciphertext),
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  `window.NERVE_ADMIN_PAYLOAD = ${JSON.stringify(payload)};\n`,
  "utf8"
);

console.log(`Wrote admin payload to ${OUTPUT}`);
