// netlify/functions/get-data.js
const admin = require('firebase-admin');

// --- START: Robustní inicializace Firebase Admin SDK ---
let db;
try {
    // Kontrola existence proměnných prostředí
    if (!process.env.FIREBASE_CREDENTIALS || !process.env.FIREBASE_DATABASE_URL) {
        throw new Error('Chybí FIREBASE_CREDENTIALS nebo FIREBASE_DATABASE_URL v proměnných prostředí.');
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    const databaseURL = process.env.FIREBASE_DATABASE_URL;

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
        });
    }
    db = admin.database();
} catch (error) {
    console.error("KRITICKÁ CHYBA: Inicializace Firebase Admin SDK selhala!", error);
    // Pokud inicializace selže, databáze nebude dostupná.
    // Funkce handler vrátí chybu níže.
}
// --- END: Robustní inicializace Firebase Admin SDK ---

exports.handler = async function(event, context) {
    // Pokud selhala inicializace, vrať okamžitě chybu 500
    if (!db) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to initialize Firebase Admin. Zkontrolujte proměnné prostředí na Netlify.' }),
        };
    }

    try {
        const ref = db.ref('/');
        const snapshot = await ref.once('value');
        const data = snapshot.val();

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Chyba při načítání dat z Firebase:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data from Firebase.' }),
        };
    }
};

