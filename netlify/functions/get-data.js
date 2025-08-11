// Importuje Firebase Admin SDK pro komunikaci s databází
const admin = require('firebase-admin');

// Načte přihlašovací údaje z proměnných prostředí
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

// Inicializuje Firebase aplikaci, pokud ještě nebyla inicializována
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL // Použije správnou URL z nastavení Netlify
  });
}

const db = admin.database();

// Handler funkce, která se spustí při zavolání z webové stránky
exports.handler = async function(event, context) {
    try {
        const ref = db.ref('/');
        const snapshot = await ref.once('value');
        let data = snapshot.val();

        // Zkontroluje, zda jsou data vnořena pod dalším klíčem
        const dataKeys = Object.keys(data);
        if (dataKeys.length === 1) {
            data = data[dataKeys[0]];
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch data.' }),
        };
    }
};
