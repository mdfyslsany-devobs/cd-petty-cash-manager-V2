import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirestore, initializeFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, addDoc, deleteDoc, updateDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
});
export const auth = getAuth(app);

// Auth Helpers
export const loginWithEmailPassword = async (email: string, password: string) => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.error("Login Error:", error);
    let errorMessage = "Login failed";
    
    if (error.code === 'auth/invalid-email') {
      errorMessage = "Invalid email address";
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = "User not found. Please check your email.";
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = "Incorrect password";
    } else if (error.code === 'auth/invalid-credential') {
      errorMessage = "Invalid email or password";
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = "This account has been disabled";
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = "Too many failed login attempts. Please try again later.";
    }
    
    throw new Error(errorMessage);
  }
};

export const logout = () => signOut(auth);

// Error Handling Spec for Firestore Permissions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
