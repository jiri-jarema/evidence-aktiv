import { getCurrentUser } from './state.js';

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
 * @param {string} odborId - The ID of the department.
 * @param {object} newAgendaData - The data for the new agenda.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function createNewAgenda(odborId, newAgendaData) {
    const user = getCurrentUser();
    if (!user) return false;

    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/create-agenda', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ odborId, newAgendaData })
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

// --- User Management API ---

/**
 * Fetches all users from the server.
 * @returns {Promise<{success: boolean, users?: object[], error?: Error}>}
 */
export async function getUsers() {
    const user = getCurrentUser();
    if (!user) return { success: false, error: new Error('Not authenticated') };
    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/get-users', {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error(await response.text());
        const users = await response.json();
        return { success: true, users };
    } catch (error) {
        console.error('Chyba při načítání uživatelů:', error);
        return { success: false, error };
    }
}

/**
 * Creates a new user on the server.
 * @param {object} userData - Data for the new user.
 * @returns {Promise<boolean>}
 */
export async function createUser(userData) {
    const user = getCurrentUser();
    if (!user) return false;
    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/create-user', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify(userData)
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při vytváření uživatele:', error);
        alert(`Nepodařilo se vytvořit uživatele: ${error.message}`);
        return false;
    }
}

/**
 * Updates an existing user on the server.
 * @param {string} uid - The UID of the user to update.
 * @param {object} userData - The data to update.
 * @returns {Promise<boolean>}
 */
export async function updateUser(uid, userData) {
    const user = getCurrentUser();
    if (!user) return false;
    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/update-user', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ uid, ...userData })
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při aktualizaci uživatele:', error);
        alert(`Nepodařilo se aktualizovat uživatele: ${error.message}`);
        return false;
    }
}

/**
 * Deletes a user from the server.
 * @param {string} uid - The UID of the user to delete.
 * @returns {Promise<boolean>}
 */
export async function deleteUser(uid) {
    const user = getCurrentUser();
    if (!user) return false;
    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/delete-user', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ uid })
        });
        if (!response.ok) throw new Error(await response.text());
        return true;
    } catch (error) {
        console.error('Chyba při mazání uživatele:', error);
        alert(`Nepodařilo se smazat uživatele: ${error.message}`);
        return false;
    }
}
