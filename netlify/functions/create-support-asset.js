// netlify/functions/create-support-asset.js
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

// Helper function to recursively find agenda path (same as in update-support-asset.js)
async function findAgendaPath(agendaId) {
    const agendyRef = db.ref('agendy');
    const snapshot = await agendyRef.once('value');
    const data = snapshot.val();
    
    function search(currentPath, currentNode) {
        if (!currentNode) return null;
        for (const key in currentNode) {
            const newPath = currentPath ? `${currentPath}/${key}` : key;
            if (key === agendaId) {
                return newPath;
            }
            if (typeof currentNode[key] === 'object' && currentNode[key] && currentNode[key].children) {
                const result = search(`${newPath}/children`, currentNode[key].children);
                if (result) return result;
            }
        }
        return null;
    }
    
    const resultPath = search('children', data.children);
    return resultPath ? `agendy/${resultPath}` : null;
}

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { user, error } = await verifyUser(event.headers.authorization);
    if (error) return error;

    if (user.role !== 'administrator') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Insufficient permissions. Administrator role required.' }) };
    }

    try {
        const { assetPath, newAssetData, reciprocalLinks } = JSON.parse(event.body);
        
        const updates = {};
        
        // Set the new asset data
        updates[assetPath] = newAssetData;

        // Handle reciprocal links to add (Standard links)
        if (reciprocalLinks && reciprocalLinks.toAdd) {
            for (const link of reciprocalLinks.toAdd) {
                const { targetPath, sourceId } = link;
                const snapshot = await db.ref(targetPath).once('value');
                let links = snapshot.val() || [];
                if (!Array.isArray(links)) links = [];
                if (!links.includes(sourceId)) {
                    links.push(sourceId);
                }
                updates[targetPath] = links;
            }
        }

        // Handle reciprocal links to Agendas (AIS context - special case for IS -> Agenda)
        if (reciprocalLinks && reciprocalLinks.aisToAdd) {
            // Need to extract the sourceId for the AIS link. It should be the ID of the new asset being created.
            // Since aisToAdd is just an array of agenda IDs, we assume the source is the new asset.
            // But we need the ID. The 'assetPath' ends with the ID.
            const sourceId = assetPath.split('/').pop();

            for (const agendaId of reciprocalLinks.aisToAdd) {
                const agendaPath = await findAgendaPath(agendaId);
                if (agendaPath) {
                     const zpPath = `${agendaPath}/details/Způsob zpracování/value`;
                     const snapshot = await db.ref(zpPath).once('value');
                     let methods = snapshot.val();
                     if (Array.isArray(methods)) {
                         // Find the AIS method and update it
                         // We map over methods to update the specific one, then write back the whole array
                         // because Firebase updates work best with known paths or complete objects
                         const updatedMethods = methods.map(method => {
                             if (method.label && method.label.includes('agendový informační systém')) {
                                 let currentLinks = method.linksTo || [];
                                 if (!currentLinks.includes(sourceId)) {
                                     currentLinks.push(sourceId);
                                 }
                                 return { ...method, linksTo: currentLinks };
                             }
                             return method;
                         });
                         updates[zpPath] = updatedMethods;
                     }
                }
            }
        }

        await db.ref().update(updates);

        return {
            statusCode: 201,
            body: JSON.stringify({ success: true, message: 'Asset created successfully.' }),
        };
    } catch (err) {
        console.error("Error creating asset:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to create asset.' }),
        };
    }
};