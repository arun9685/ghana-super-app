import crypto from "node:crypto";

// HMAC-SHA256 over the raw request body, the same scheme MoMo/Paystack/
// Flutterwave-style gateways use for webhook signing: the caller signs the
// exact bytes sent, we recompute over the exact bytes received (never the
// re-serialized/parsed JSON, which can differ byte-for-byte and would make
// a correct signature fail verification), and compare in constant time.
export function computeWebhookSignature(rawBody: Buffer | string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = computeWebhookSignature(rawBody, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const givenBuf = Buffer.from(signatureHeader, "hex");
  // timingSafeEqual throws if lengths differ, which a malformed/forged
  // header will often do — treat that as "not valid" rather than a crash.
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}
