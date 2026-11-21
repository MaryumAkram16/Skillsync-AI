import admin from "firebase-admin";

/**
 * Credential for the Firebase Admin SDK.
 *
 * Cloud Run (and local dev with `gcloud auth application-default login`)
 * provide Application Default Credentials automatically. Vercel does not, so
 * there the service-account key comes from the FIREBASE_SERVICE_ACCOUNT
 * environment variable: the key file's JSON as-is, or base64-encoded.
 */
export function firebaseCredential(): admin.credential.Credential {
  // Forgive common paste mistakes: a byte-order mark, or the whole value wrapped in quotes.
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").replace(/^\uFEFF/, "").trim();
  if (/^(['"]).*\1$/s.test(raw)) raw = raw.slice(1, -1).trim();
  if (!raw) return admin.credential.applicationDefault();
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  let parsed: admin.ServiceAccount & { private_key?: string };
  try {
    parsed = JSON.parse(json);
  } catch {
    // Never echo the value: it is a private key.
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is set but is not valid service-account JSON (raw or base64). " +
        "Paste the whole contents of the key file (starting with { and ending with }), not its file name or path.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || typeof parsed.private_key !== "string" || !(parsed as any).client_email) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is JSON but not a service-account key (private_key or client_email is missing).");
  }
  // Some dashboards turn the key's "\n" escapes into literal backslash-n.
  if (typeof parsed.private_key === "string") parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return admin.credential.cert(parsed);
}
