// netlify/functions/update-agenda.js
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.database();

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { path, data } = JSON.parse(event.body);
        const ref = db.ref(path);
        
        await ref.update(data);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true }),
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update agenda.' }),
        };
    }
};