// Import the functions needed from the SDKs
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDwFyFylwznhFR2X1YXI7rnJnlNtnZhYPI",
    authDomain: "maps-test-14733.firebaseapp.com",
    projectId: "maps-test-14733",
    storageBucket: "maps-test-14733.appspot.com",
    messagingSenderId: "393469563141",
    appId: "1:393469563141:web:c4dad9072b4917bd9a676c",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getFirestore(app);
const storage = getStorage(app);

export { app, database, storage };
