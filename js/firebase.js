// This file handles Firebase configuration and initialization.

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBcoossk-fHBUrNd3x2Dd3bS-auCcvgwEk",
    authDomain: "aktiva-vitkov.firebaseapp.com",
    databaseURL: "https://aktiva-vitkov-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "aktiva-vitkov",
    storageBucket: "aktiva-vitkov.appspot.com",
    messagingSenderId: "6167416010",
    appId: "1:6167416010:web:ba5cca4eb0aa0eac343833"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services
export const auth = firebase.auth();
export const db = firebase.database();
