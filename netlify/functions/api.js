import { getCurrentUser, setAssetData, setSharedOptions, setAllAssets, setParentMap } from './state.js';
import { buildNav } from './ui.js';
import { flattenData, buildParentMap } from './utils.js';
import * as dom from './dom.js';

/**
 * Fetches the initial data from the server and populates the app.
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

        const newAssetData = {
            primarni: data.primarni,
            podpurna: data.podpurna,
            agendy: data.agendy
        };
        
        setAssetData(newAssetData);
        setSharedOptions(data.options);
        
        const flatData = flattenData(newAssetData);
        setAllAssets(flatData);

        const newParentMap = {};
        buildParentMap(newAssetData, newParentMap);
        setParentMap(newParentMap);
        
        dom.sidebar.innerHTML = ''; 
        buildNav(newAssetData, dom.sidebar);

        dom.welcomeMessage.querySelector('h2').textContent = 'Vítejte v evidenci aktiv';
        dom.welcomeMessage.querySelector('p').textContent = 'Vyberte položku z menu vlevo pro zobrazení detailů.';
        dom.welcomeMessage.classList.remove('hidden');
        dom.assetDetailContainer.classList.add('hidden');


    } catch (error) {
        console.error('Chyba při načítání dat:', error);
        dom.welcomeMessage.querySelector('h2').textContent = 'Chyba při načítání dat';
        dom.welcomeMessage.querySelector('p').textContent = 'Zkuste prosím obnovit stránku. Chyba: ' + error.message;
    }
}

/**
 * Creates a new agenda item on the server.
 * @param {string} odborId - The ID of the department.
 * @param {string} newAgendaId - The unique ID for the new agenda.
 * @param {object} newAgendaData - The data for the new agenda.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function createNewAgenda(odborId, newAgendaId, newAgendaData) {
    const user = getCurrentUser();
    if (!user) return false;

    const idToken = await user.getIdToken();
    try {
        const response = await fetch('/.netlify/functions/create-agenda', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ odborId, newAgendaId, newAgendaData })
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
