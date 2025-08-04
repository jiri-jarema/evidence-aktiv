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
        // Zpracuje data odeslaná z formuláře pro vytvoření nové agendy
        const { parentId, newAgendaId, newAgendaData } = JSON.parse(event.body);
        
        //
        // ZDE BUDE V BUDOUCNU LOGIKA PRO PŘIDÁNÍ NOVÉ AGENDY DO DATABÁZE
        //
        // Příklad:
        // const docRef = db.collection('agendy').doc('data');
        // const path = `children.${parentId}.children.${newAgendaId}`;
        // await docRef.update({
        //     [path]: newAgendaData
        // });

        // Vrací potvrzení o úspěšném vytvoření
        return {
            statusCode: 201, // 201 Created
            body: JSON.stringify({ success: true, message: 'Agenda vytvořena (funkce je zatím pouze placeholder).' }),
        };
    } catch (error) {
        console.error(error);
        // V případě chyby vrací chybovou hlášku
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Nepodařilo se vytvořit agendu.' }),
        };
    }
};
