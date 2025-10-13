// netlify/functions/get-data.js
const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK
// Ujistěte se, že máte v Netlify nastavené proměnné prostředí
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

exports.handler = async function(event, context) {
    try {
        const ref = db.ref('/');
        const snapshot = await ref.once('value');
        const data = snapshot.val();

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Chyba při načítání dat:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data.' }),
        };
    }
};
