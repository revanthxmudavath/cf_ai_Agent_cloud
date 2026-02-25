import { describe, it, expect } from 'vitest';

// Mirror the verification algorithm for unit testing
async function verifyNangoWebhookSignature(
  signature: string | null,
  rawBody: string,
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  try {
    const parts = signature.split(',');
    if (parts.length < 2) return false;
    const timestampPart = parts[0];
    const hmacHex = parts[1];
    if (!timestampPart.startsWith('t=')) return false;
    const timestamp = timestampPart.slice(2);
    const webhookAge = Date.now() - parseInt(timestamp) * 1000;
    if (webhookAge > 5 * 60 * 1000) return false;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(`${timestamp}:${rawBody}`);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedHmac = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return expectedHmac === hmacHex;
  } catch {
    return false;
  }
}

async function makeSignature(body: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}:${body}`));
  const hmac = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},${hmac}`;
}

describe('Nango webhook signature verification', () => {
  const secret = 'test-webhook-secret';
  const body = '{"type":"auth","operation":"creation","success":true}';

  it('should accept a valid signature', async () => {
    const sig = await makeSignature(body, secret);
    expect(await verifyNangoWebhookSignature(sig, body, secret)).toBe(true);
  });

  it('should reject null signature', async () => {
    expect(await verifyNangoWebhookSignature(null, body, secret)).toBe(false);
  });

  it('should reject wrong secret', async () => {
    const sig = await makeSignature(body, secret);
    expect(await verifyNangoWebhookSignature(sig, body, 'wrong-secret')).toBe(false);
  });

  it('should reject tampered body', async () => {
    const sig = await makeSignature(body, secret);
    expect(await verifyNangoWebhookSignature(sig, body + 'tampered', secret)).toBe(false);
  });

  it('should reject expired signature older than 5 minutes', async () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${oldTimestamp}:${body}`));
    const hmac = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyNangoWebhookSignature(`t=${oldTimestamp},${hmac}`, body, secret)).toBe(false);
  });

  it('should reject malformed signature format', async () => {
    expect(await verifyNangoWebhookSignature('notvalidformat', body, secret)).toBe(false);
  });
});
