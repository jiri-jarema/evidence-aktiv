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

    const { assetPath, assetId, reciprocalLinks } = JSON.parse(event.body);

    if (!assetPath) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: Missing assetPath.' }) };
    }

    // Kontrola oprávnění pro mazání
    let isAllowed = false;
    
    // Administrator může mazat cokoliv
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
        const updates = {};
        
        // 1. Mark the asset itself for deletion
        updates[assetPath] = null;

        // 2. Remove reciprocal links (Standard links - arrays of IDs)
        if (reciprocalLinks && reciprocalLinks.simpleLinks && Array.isArray(reciprocalLinks.simpleLinks)) {
            for (const linkPath of reciprocalLinks.simpleLinks) {
                const snapshot = await db.ref(linkPath).once('value');
                let links = snapshot.val();
                
                if (Array.isArray(links)) {
                    // Filter out the deleted asset ID
                    const filteredLinks = links.filter(id => id !== assetId);
                    // Update: if empty, set to null or empty string depending on convention
                    updates[linkPath] = filteredLinks.length > 0 ? filteredLinks : null;
                }
            }
        }

        // 3. Remove reciprocal links in Agendas (Complex object structure in "Způsob zpracování")
        if (reciprocalLinks && reciprocalLinks.agendaLinks && Array.isArray(reciprocalLinks.agendaLinks)) {
            for (const linkPath of reciprocalLinks.agendaLinks) {
                // linkPath points to ".../details/Způsob zpracování/value" which is an array of method objects
                const snapshot = await db.ref(linkPath).once('value');
                let methods = snapshot.val();

                if (Array.isArray(methods)) {
                    // Map over the methods array to modify the relevant item without changing array length
                    const updatedMethods = methods.map(method => {
                        // Find the method corresponding to AIS
                        if (method.label && method.label.includes('agendový informační systém') && method.linksTo) {
                            // Filter out the deleted asset ID from the linksTo array
                            const newLinksTo = method.linksTo.filter(id => id !== assetId);
                            return { ...method, linksTo: newLinksTo };
                        }
                        return method;
                    });
                    updates[linkPath] = updatedMethods;
                }
            }
        }

        // 4. Perform atomic update
        await db.ref().update(updates);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Asset deleted successfully including reciprocal links.' }),
        };
    } catch (err) {
        console.error("Error deleting asset:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to delete asset.' }),
        };
    }
};