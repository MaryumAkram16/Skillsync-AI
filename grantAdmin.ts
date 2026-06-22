/**
 * grantAdmin.ts — one-off CLI script to grant or revoke admin on a user.
 *
 * Run with: npx tsx grantAdmin.ts <uid> grant
 *           npx tsx grantAdmin.ts <uid> revoke
 *
 * Uses the admin SDK directly, which bypasses firestore.rules entirely —
 * this is intentional and is the ONLY supported way to grant admin now that
 * isValidUserProfile() blocks users from setting isAdmin/role on themselves.
 */
import { adminDb } from "./services/firebaseAdmin";

async function main() {
  const [uid, action] = process.argv.slice(2);

  if (!uid || !action || !["grant", "revoke"].includes(action)) {
    console.error("Usage: npx tsx grantAdmin.ts <uid> <grant|revoke>");
    process.exit(1);
  }

  const userRef = adminDb.collection("users").doc(uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    console.error(`No user document found for uid="${uid}"`);
    process.exit(1);
  }

  await userRef.update({ isAdmin: action === "grant" });
  console.log(`✓ ${action === "grant" ? "Granted" : "Revoked"} admin for uid="${uid}"`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});