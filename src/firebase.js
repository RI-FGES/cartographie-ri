import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCERDstqVvUEtYUYXV39to2GFf7iNQ81OI",
  authDomain: "ri-fges-cartographie.firebaseapp.com",
  projectId: "ri-fges-cartographie",
  storageBucket: "ri-fges-cartographie.firebasestorage.app",
  messagingSenderId: "860399969900",
  appId: "1:860399969900:web:af34c70752877eac0c5a49"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);