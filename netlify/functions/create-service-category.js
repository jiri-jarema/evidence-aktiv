// netlify/functions/create-service-category.js
const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();

/**
 * Sanitizes text to be used as part of an ID.
 * @param {string} text - The text to sanitize.
 * @returns {string} - The sanitized text.
 */
function sanitizeForId(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Nahradí mezery pomlčkami
        .replace(/[^\w\-]+/g, '')       // Odstraní všechny ne-word znaky
        .replace(/\-\-+/g, '-')         // Nahradí vícenásobné pomlčky jednou
        .replace(/^-+/, '')             // Ořízne pomlčky ze začátku
        .replace(/-+$/, '');            // Ořízne pomlčky z konce
}


exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { authorization } = event.headers;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return { statusCode: 401, body: 'Unauthorized' };
    }

    const idToken = authorization.split('Bearer ')[1];
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        return { statusCode: 401, body: 'Unauthorized' };
    }
    
    const uid = decodedToken.uid;
    const userRef = admin.database().ref(`users/${uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    if (!userData || userData.role !== 'administrator') {
        return { statusCode: 403, body: 'Forbidden' };
    }
    
    try {
        const { parentId, name } = JSON.parse(event.body);
        
        // Generate a sanitized, readable key from the category name
        const newCategoryId = sanitizeForId(name);
        
        const newCategoryRef = db.ref(`primarni/children/${parentId}/children/${newCategoryId}`);
        
        // Check if a category with this key already exists
        const existingCategorySnapshot = await newCategoryRef.once('value');
        if (existingCategorySnapshot.exists()) {
            return {
                statusCode: 409, // Conflict
                body: JSON.stringify({ error: 'Kategorie s tímto názvem již existuje.' }),
            };
        }

        await newCategoryRef.set({
            name: name
            // Firebase automatically handles empty children, no need to explicitly set children: {}
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, id: newCategoryRef.key }),
        };
    } catch (error) {
        console.error('Error creating service category:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create service category.' }),
        };
    }
};