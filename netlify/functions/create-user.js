// netlify/functions/create-user.js
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
        const { email, password, role, odbor } = JSON.parse(event.body);

        if (!email || !password || !role) {
            return { statusCode: 400, body: 'Bad Request: Missing required fields.' };
        }

        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
        });

        const userData = { role };
        if (role === 'garant' && odbor) {
            userData.odbor = odbor;
        }

        await db.ref(`users/${userRecord.uid}`).set(userData);

        return {
            statusCode: 201,
            body: JSON.stringify({ success: true, uid: userRecord.uid }),
        };
    } catch (error) {
        console.error("Error creating user:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Failed to create user: ${error.message}` }),
        };
    }
};
