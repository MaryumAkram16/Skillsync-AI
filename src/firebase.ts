import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  setLogLevel
} from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK or return existing app to handle HMR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);

// Validate Connection to Firestore
async function testConnection() {
  try {
    // We suppress internal Firebase console logging temporarily to avoid the scary "unavailable" warning 
    // that fires during normal long-polling fallback.
    setLogLevel('silent');
    
    // Attempt to fetch a non-existent document to test connection from server
    await getDocFromServer(doc(db, '_connection_test_', 'init'));
    
    // Restore log level
    setLogLevel('error');
    console.log("Firestore connection verified.");
  } catch (error) {
    setLogLevel('error');
    
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
        console.warn("Firestore appears to be offline or unavailable. The app will continue in offline mode.");
      } else {
        console.warn("Firestore connection attempt (safe to ignore if app works):", error.message);
      }
    }
  }
}

testConnection();
