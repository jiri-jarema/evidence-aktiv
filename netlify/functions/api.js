import { getCurrentUser, getAllAssets } from './state.js';
import { getPathForAsset } from './utils.js';


/**
 * Fetches the initial data from the server.
 * @returns {Promise<{success: boolean, data?: object, error?: Error}>} - An object with data or an error.
 */
export async function loadInitialData() {
     try {
        const response = await fetch('/.netlify/functions/get-data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data || !data.primarni || !data.podpurna || !data.agendy || !data.options) {
            throw new Error("Načtená data nemají správnou strukturu.");
        }
        return { success: true, data };
    } catch (error) {
        console.error('Chyba při načítání dat:', error);
        return { success: false, error };
    }
}

/**
 * Creates a new agenda item on the server.
 * @param {object} payload - The data for the new agenda.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function createNewAgenda(payload) {
    const user = getCurrentUser();
    if (!user) return false;

    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/create-agenda', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při vytváření nové agendy:', error);
        alert('Nepodařilo se vytvořit novou agendu.');
        return false;
    }
}

/**
 * Creates a new support/primary asset on the server.
 * @param {object} payload - The data payload for the creation.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function createNewSupportAsset(payload) {
    const user = getCurrentUser();
    if (!user) return false;

    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/create-support-asset', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při vytváření nového aktiva:', error);
        alert('Nepodařilo se vytvořit nové aktivum.');
        return false;
    }
}

/**
 * Updates an existing agenda item on the server.
 * @param {object} payload - The data payload for the update.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function updateAgenda(payload) {
    const user = getCurrentUser();
    if (!user) return false;

    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/update-agenda', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při ukládání změn agendy:', error);
        alert('Nepodařilo se uložit změny. Zkontrolujte svá oprávnění.');
        return false;
    }
}

/**
 * Updates a support asset on the server.
 * @param {object} payload - The data payload for the update.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function updateSupportAsset(payload) {
    const user = getCurrentUser();
    if (!user) return false;

    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/update-support-asset', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při ukládání změn podpůrného aktiva:', error);
        alert('Nepodařilo se uložit změny. Zkontrolujte svá oprávnění.');
        return false;
    }
}

/**
 * Updates a service asset on the server.
 * @param {object} payload - The data payload for the update.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function updateService(payload) {
    const user = getCurrentUser();
    if (!user) return false;

    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/update-service', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při ukládání změn služby:', error);
        alert('Nepodařilo se uložit změny. Zkontrolujte svá oprávnění.');
        return false;
    }
}

/**
 * Deletes an agenda item and its reciprocal links from the server.
 * @param {string} assetId - The ID of the agenda to delete.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function deleteAgenda(assetId) {
    const user = getCurrentUser();
    if (!user) return false;

    const allAssets = getAllAssets();
    const assetToDelete = allAssets[assetId];
    if (!assetToDelete) {
        console.error('Asset to delete not found in state.');
        return false;
    }

    // Find linked systems
    const linkedSystems = [];
    const processingMethods = assetToDelete.details?.["Způsob zpracování"]?.value || [];
    const aisMethod = processingMethods.find(m => m.label.includes("agendový informační systém"));
    if (aisMethod && aisMethod.linksTo) {
        linkedSystems.push(...aisMethod.linksTo);
    }

    const agendaPath = getPathForAsset(assetId);
    const idToken = await user.getIdToken();

    try {
        const response = await fetch('/.netlify/functions/delete-agenda', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ agendaId: assetId, agendaPath, linkedSystems })
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při mazání agendy:', error);
        alert('Nepodařilo se smazat agendu.');
        return false;
    }
}


// === Admin user management API (appended) ===

export async function fetchUsers() {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/get-users', {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  if (!res.ok) throw new Error(await res.text());
  const { users } = await res.json();
  return users || {};
}

export async function upsertUser({ uid, email, role, odbor }) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/upsert-user', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ uid, email, role, odbor })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function deleteUserByUid(uid) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/delete-user', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ uid })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
