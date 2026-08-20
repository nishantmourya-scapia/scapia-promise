// Sanity bounds for a plausible INR product price. Anything outside this
// range is almost certainly a mis-extraction (e.g. a quantity, a year, a
// phone number picked off the page) rather than a real price.
const MIN_SANE_PRICE = 1;
const MAX_SANE_PRICE = 1_000_000;

// The price must actually appear in the scraped page text (commas
// stripped), not just be a plausible-looking number the model produced.
// Digit-boundary lookaround avoids "99" spuriously matching inside "1999".
function isGrounded(price, scrapedText) {
  const normalizedPage = scrapedText.replace(/,/g, '');
  const priceDigits = String(price);
  const groundedPattern = new RegExp(`(?<!\\d)${priceDigits}(?!\\d)`);
  return groundedPattern.test(normalizedPage);
}

// Fallback for when the model couldn't produce a usable price at all
// (no_price_found / unparseable_response) — pull a price directly off the
// raw scraped text ourselves. This also sidesteps anything that mangles
// digits between the tool result and the model's final answer (e.g. a
// gateway-side redaction pass mistaking a price for a phone number), since
// we're reading text we already hold locally, not the model's response.
// Lower-trust than the model's own extraction: no judgment about whether
// this is the current sale price vs. an MSRP or unrelated number, so
// callers should treat it as a degraded, not verified, result.
const CURRENCY_PRICE_PATTERN = /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i;

function extractPriceFromText(scrapedText) {
  const match = scrapedText.match(CURRENCY_PRICE_PATTERN);
  if (!match) return null;

  const value = Number(match[1].replace(/,/g, ''));
  if (value < MIN_SANE_PRICE || value > MAX_SANE_PRICE) return null;
  return value;
}

export function parseAgentResponse(text, scrapedText) {
  const priceMatch = text.match(/PRICE:\s*([\d,]+(?:\.\d+)?)/i);
  const basisMatch = text.match(/BASIS:\s*(.+)/i);

  const rawPrice = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;
  const basis = basisMatch ? basisMatch[1].trim() : null;

  let guardrail = 'ok';
  if (rawPrice === null) {
    guardrail = 'unparseable_response';
  } else if (rawPrice === 0) {
    guardrail = 'no_price_found';
  } else if (rawPrice < MIN_SANE_PRICE || rawPrice > MAX_SANE_PRICE) {
    guardrail = 'out_of_range';
  } else if (!isGrounded(rawPrice, scrapedText)) {
    guardrail = 'ungrounded';
  }

  if (guardrail === 'no_price_found' || guardrail === 'unparseable_response') {
    const fallbackPrice = extractPriceFromText(scrapedText);
    if (fallbackPrice !== null) {
      return { price: null, guardrail: 'regex_fallback', basis, rawPrice: fallbackPrice };
    }
  }

  const price = guardrail === 'ok' ? rawPrice : null;
  return { price, guardrail, basis, rawPrice };
}
