import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server';
import { firebaseCredential } from '../services/firebaseCredential';

describe('createApp for Vercel (frontend "none")', () => {
  let base = '';
  let close = () => {};

  beforeAll(async () => {
    const app = await createApp('none');
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });
  afterAll(() => close());

  it('builds without starting a listener of its own and serves the API routes', async () => {
    const res = await fetch(`${base}/api/parse-resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: 'x' }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('Unauthorized') });
  });

  it('leaves the frontend to the CDN: non-API paths are not served by the function', async () => {
    const res = await fetch(`${base}/dashboard`);
    expect(res.status).toBe(404);
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

  it('routes /api to the Express function and everything else to the SPA', () => {
    expect(config.rewrites).toEqual([
      { source: '/api/(.*)', destination: '/api' },
      { source: '/((?!api/).*)', destination: '/index.html' },
    ]);
  });

  it('allows the slow AI routes the same 5 minutes the frontend waits', () => {
    expect(config.functions['api/index.ts'].maxDuration).toBe(300);
    const api = readFileSync(new URL('../src/utils/api.ts', import.meta.url), 'utf8');
    expect(api).toContain('timeoutMs: 300000');
  });
});

describe('firebaseCredential', () => {
  const original = process.env.FIREBASE_SERVICE_ACCOUNT;
  afterAll(() => {
    if (original === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
    else process.env.FIREBASE_SERVICE_ACCOUNT = original;
  });

  const account = {
    type: 'service_account',
    project_id: 'test-project',
    client_email: 'svc@test-project.iam.gserviceaccount.com',
    // A throwaway key generated for the test, never a real credential.
    private_key: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };

  it('falls back to Application Default Credentials when the variable is unset (Cloud Run, local)', () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    expect(firebaseCredential().constructor.name).not.toBe('ServiceAccountCredential');
  });

  it('accepts the key file JSON as-is or base64-encoded', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(account);
    expect(firebaseCredential().constructor.name).toBe('ServiceAccountCredential');
    process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(account)).toString('base64');
    expect(firebaseCredential().constructor.name).toBe('ServiceAccountCredential');
  });

  it('rejects an invalid value without echoing it', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{not json SECRET-VALUE';
    expect(() => firebaseCredential()).toThrow(/not valid service-account JSON/);
    try { firebaseCredential(); } catch (e) { expect(String(e)).not.toContain('SECRET-VALUE'); }
  });
});
