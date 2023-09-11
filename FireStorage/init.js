const { initializeApp } = require('firebase/app');
require('dotenv').config();

//const { getAnalytics } = require("firebase/analytics");s

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.FS_API,
  authDomain: "beambotfilestorage.firebaseapp.com",
  projectId: "beambotfilestorage",
  storageBucket: "beambotfilestorage.appspot.com",
  messagingSenderId: "1040672383555",
  appId: "1:1040672383555:web:29245c2e15b981dbd36af6",
  measurementId: "G-YT9658RL4J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

module.exports = app;