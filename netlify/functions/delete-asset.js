// netlify/functions/delete-asset.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

async function verifyUser(authorization) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return { error: { statusCode: 401, body: 'Unauthorized: Missing token' } };
    }
    const idToken = authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const userSnapshot = await db.ref(`users/${uid}`).once('value');
        const userData = userSnapshot.val();
        if (!userData || !userData.role) {
            return { error: { statusCode: 403, body: 'Forbidden: No role assigned' } };
        }
        return { user: { uid, ...userData } };
    } catch (error) {
        console.error("Token verification failed:", error);
        return { error: { statusCode: 401, body: 'Unauthorized: Invalid token' } };
    }
}

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { user, error } = await verifyUser(event.headers.authorization);
    if (error) return error;

    const { assetPath } = JSON.parse(event.body);

    if (!assetPath) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Missing assetPath.' }) };
    }

    // Kontrola oprávnění pro mazání
    let isAllowed = false;
    
    // Administrator může mazat cokoliv (co není agenda - pro ty je delete-agenda.js, ale technicky by to šlo i tady)
    if (user.role === 'administrator') {
        isAllowed = true;
    } 
    // Informatik může mazat jen svá aktiva
    else if (user.role === 'informatik') {
        if (
            assetPath.startsWith('primarni/children/informacni-systemy') ||
            assetPath.startsWith('podpurna/children/servery') ||
            assetPath.startsWith('podpurna/children/databaze') ||
            assetPath.startsWith('podpurna/children/site')
        ) {
            isAllowed = true;
        }
    }

    if (!isAllowed) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }) };
    }

    try {
        // Jednoduché smazání uzlu
        // Poznámka: Toto smazání neřeší automatické odstranění recipročních vazeb v jiných objektech.
        // Pro dokonalou integritu dat by bylo nutné projít databázi a odstranit ID smazaného aktiva z polí 'linksTo'.
        // Vzhledem k složitosti a riziku chyb při procházení celého stromu se zde provádí pouze smazání samotného objektu.
        // Rozbité odkazy v UI nebudou fungovat (zobrazí se jako neaktivní nebo zmizí při příštím uložení).
        
        await db.ref(assetPath).remove();

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Asset deleted successfully.' }),
        };
    } catch (err) {
        console.error("Error deleting asset:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to delete asset.' }),
        };
    }
};