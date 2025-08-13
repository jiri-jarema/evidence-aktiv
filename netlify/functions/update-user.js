// netlify/functions/update-user.js
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
        return { statusCode: 401, body: 'Unauthorized: Invalid token' };
    }

    const requesterUid = decodedToken.uid;
    const requesterSnapshot = await db.ref(`users/${requesterUid}`).once('value');
    const requesterData = requesterSnapshot.val();

    if (!requesterData || requesterData.role !== 'administrator') {
        return { statusCode: 403, body: 'Forbidden: Administrator role required.' };
    }

    try {
        const { uid, email, password, role, odbor } = JSON.parse(event.body);

        if (!uid || !role) {
            return { statusCode: 400, body: 'Bad Request: Missing required fields.' };
        }

        const authUpdates = {};
        if (email) authUpdates.email = email;
        if (password) authUpdates.password = password;

        if (Object.keys(authUpdates).length > 0) {
            await admin.auth().updateUser(uid, authUpdates);
        }

        const dbUpdates = { role };
        if (role === 'garant' && odbor) {
            dbUpdates.odbor = odbor;
        } else {
            dbUpdates.odbor = null; // Remove odbor if role is not garant
        }

        await db.ref(`users/${uid}`).update(dbUpdates);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (error) {
        console.error("Error updating user:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Failed to update user: ${error.message}` }),
        };
    }
};
