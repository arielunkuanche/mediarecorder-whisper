import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCJqhv9dd2EAqbOG1Z8ycDMCM5GvLiMmw8",
    authDomain: "mediarecorder-test-f70fd.firebaseapp.com",
    projectId: "mediarecorder-test-f70fd",
    storageBucket: "mediarecorder-test-f70fd.firebasestorage.app",
    messagingSenderId: "721345529006",
    appId: "1:721345529006:web:fd8c2c22de02635129193f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };