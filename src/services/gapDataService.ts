import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firestoreErrors";

export const gapDataService = {
  async saveGapData(userId: string, data: any) {
    if (!userId) return;
    const docRef = doc(db, "gapData", userId);
    try {
      await setDoc(docRef, {
        data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `gapData/${userId}`);
    }
  },

  async getGapData(userId: string) {
    if (!userId) return null;
    const docRef = doc(db, "gapData", userId);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().data;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `gapData/${userId}`);
      return null;
    }
  },

  clearLocalData() {
    localStorage.removeItem("skillsync_data");
  }
};
