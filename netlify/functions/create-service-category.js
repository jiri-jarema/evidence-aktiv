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
        const newCategoryRef = db.ref(`primarni/children/${parentId}/children`).push();
        await newCategoryRef.set({
            name: name,
            children: {}
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