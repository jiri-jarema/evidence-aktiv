const admin = require('firebase-admin');

// Inicializace (stejná jako v ostatních funkcích)
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

// CORS hlavičky pro povolení volání z nástroje
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function verifyUser(authorization) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new Error('Unauthorized');
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // Kontrola role v databázi
    const userSnapshot = await db.ref(`users/${uid}`).once('value');
    const userData = userSnapshot.val();
    
    if (!userData || userData.role !== 'administrator') {
        throw new Error('Forbidden: Requires administrator role');
    }
    return userData;
}

exports.handler = async function(event, context) {
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        // 1. Ověření admina
        await verifyUser(event.headers.authorization);

        // 2. Získání dat
        const { updates } = JSON.parse(event.body);

        if (!updates || Object.keys(updates).length === 0) {
            return { 
                statusCode: 400, 
                headers, 
                body: JSON.stringify({ error: 'No updates provided' }) 
            };
        }

        console.log(`Processing batch update with ${Object.keys(updates).length} operations.`);

        // 3. Provedení atomického update
        await db.ref().update(updates);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: `Successfully updated ${Object.keys(updates).length} paths.` 
            })
        };

    } catch (err) {
        console.error("Batch update error:", err);
        return {
            statusCode: err.message.startsWith('Forbidden') ? 403 : 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};