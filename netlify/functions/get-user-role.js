// netlify/functions/get-user-role.js
const admin = require('firebase-admin');

// Inicializace Firebase Admin SDK (stejná jako v ostatních funkcích)
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
const databaseURL = process.env.FIREBASE_DATABASE_URL;
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

exports.handler = async function(event, context) {
    const { authorization } = event.headers;

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return { statusCode: 401, body: 'Unauthorized' };
    }

    const idToken = authorization.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const userRef = admin.database().ref(`users/${uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (!userData || !userData.role) {
            return { statusCode: 403, body: 'No role assigned' };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ role: userData.role, odbor: userData.odbor || null }),
        };
    } catch (error) {
        console.error('Error verifying token or fetching role:', error);
        return { statusCode: 401, body: 'Unauthorized' };
    }
};