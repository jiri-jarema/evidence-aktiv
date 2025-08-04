// Importuje Firebase Admin SDK pro komunikaci s databází
const admin = require('firebase-admin');

// Načte přístupové klíče k Firebase z proměnných prostředí Netlify
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

// Inicializuje Firebase aplikaci, pokud ještě nebyla inicializována
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Handler funkce, která se spustí při zavolání z webové stránky
exports.handler = async function(event, context) {
    try {
        // Seznam kolekcí, které chceme z databáze načíst
        const collections = ['primarni', 'podpurna', 'agendy', 'options'];
        const data = {};

        // Projde všechny kolekce a načte z nich data
        for (const col of collections) {
            const snapshot = await db.collection(col).get();
            if (!snapshot.empty) {
                 // Předpokládáme, že každá kolekce obsahuje jeden dokument s daty
                 const docData = snapshot.docs[0].data();
                 data[col] = docData;
            }
        }

        // Vrací data ve formátu JSON s HTTP statusem 200 (OK)
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error(error);
        // V případě chyby vrací chybovou hlášku
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Nepodařilo se načíst data.' }),
        };
    }
};
