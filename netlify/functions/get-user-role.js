const admin = require('firebase-admin');

// Zajistí, že se service account parsuje pouze jednou
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
    // Pokud selže parsování, aplikace nemůže fungovat správně
    // Je vhodné zde zalogovat chybu a případně ukončit běh
}

// Inicializace Firebase Admin SDK, pokud ještě nebyla provedena
if (admin.apps.length === 0 && serviceAccount) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.error('Failed to initialize Firebase Admin SDK:', e);
    }
}

exports.handler = async (event, context) => {
    // Kontrola, zda je Firebase Admin SDK správně inicializováno
    if (admin.apps.length === 0) {
        console.error('Firebase Admin SDK not initialized.');
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Internal Server Error: Firebase Admin not initialized.' })
        };
    }

    const { authorization } = event.headers;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: Missing or invalid token.' }) };
    }

    const idToken = authorization.split('Bearer ')[1];

    try {
        // Ověření tokenu. Dekódovaný token již obsahuje custom claims (včetně role).
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Získání role přímo z tokenu. Není potřeba další dotaz na databázi.
        // Pokud role v tokenu není, použije se výchozí hodnota 'user'.
        const role = decodedToken.role || 'user';

        return {
            statusCode: 200,
            body: JSON.stringify({ role }),
        };
    } catch (error) {
        console.error('Error verifying token or getting user role:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Internal Server Error: Could not verify token.' }) 
        };
    }
};
