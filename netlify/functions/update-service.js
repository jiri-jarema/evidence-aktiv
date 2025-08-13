// This function is now OBSOLETE due to the data structure change.
// It is replaced by the logic in update-support-asset.js which can handle
// the new hierarchical structure of services.
// You can delete this file from your netlify/functions directory.

exports.handler = async function(event, context) {
    return {
        statusCode: 410, // Gone
        body: JSON.stringify({ error: 'This function is obsolete due to a data structure change. Please use the generic asset update function.' }),
    };
};
