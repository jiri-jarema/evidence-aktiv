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
    // Povoluje pouze metodu POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Metoda není povolena' };
    }

    try {
        // Zpracuje data odeslaná z formuláře
        const { path, data } = JSON.parse(event.body);
        const docRef = db.collection('agendy').doc('data'); // Předpokládáme, že všechny agendy jsou v jednom dokumentu
        
        // Aktualizuje konkrétní agendu v databázi
        await docRef.update({
            [path]: data
        });

        // Vrací potvrzení o úspěšném uložení
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (error) {
        console.error(error);
        // V případě chyby vrací chybovou hlášku
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Nepodařilo se aktualizovat agendu.' }),
        };
    }
};
