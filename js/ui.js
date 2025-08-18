// js/ui.js

import {
    updateAgenda, createAgenda, deleteAgenda,
    createService as apiCreateService, updateService, deleteService,
    createSupportAsset, updateSupportAsset, deleteSupportAsset,
    getUsers, createUser, updateUser, deleteUser, exportData as apiExportData
} from './api.js';
import { state } from './state.js';
import { renderTree, renderDetails, renderUsers, findItemById } from './dom.js';

export function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

export function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// --- Správa regulovaných služeb ---

export function createService() {
    const serviceName = prompt("Zadejte název nové regulované služby:");
    if (serviceName) {
        alert("Funkce pro přidání služby do konkrétní kategorie není implementována. Službu je třeba přidat přímo do databáze.");
        // Implementace by vyžadovala výběr kategorie, do které se má služba přidat.
    }
}

export function editService(serviceId) {
    const service = findItemById(state.data, serviceId);
    if (service) {
        const newName = prompt("Zadejte nový název služby:", service.name);
        if (newName && newName !== service.name) {
            showLoading();
            updateService(serviceId, { name: newName })
                .then(() => location.reload())
                .catch(error => console.error('Chyba při aktualizaci služby:', error))
                .finally(hideLoading);
        }
    }
}

export function removeService(serviceId) {
    if (confirm("Opravdu chcete smazat tuto službu? Tím se odstraní i všechny vazby na ni.")) {
        showLoading();
        deleteService(serviceId)
            .then(() => location.reload())
            .catch(error => console.error('Chyba při mazání služby:', error))
            .finally(hideLoading);
    }
}

// --- Správa agend ---

export function editAgenda(agendaId) {
    const agenda = findItemById(state.data, agendaId);
    if (agenda) {
        const newName = prompt("Zadejte nový název agendy:", agenda.name);
        if (newName && newName !== agenda.name) {
            showLoading();
            updateAgenda(agendaId, { name: newName })
                .then(() => location.reload())
                .catch(error => console.error('Chyba při aktualizaci agendy:', error))
                .finally(hideLoading);
        }
    }
}

export function addAgenda() {
    const agendaName = prompt("Zadejte název nové agendy:");
    if (agendaName) {
        alert("Funkce pro přidání agendy do konkrétního odboru není implementována. Agendu je třeba přidat přímo do databáze.");
    }
}

export function removeAgenda(agendaId) {
    if (confirm("Opravdu chcete smazat tuto agendu?")) {
        showLoading();
        deleteAgenda(agendaId)
            .then(() => location.reload())
            .catch(error => console.error('Chyba při mazání agendy:', error))
            .finally(hideLoading);
    }
}

// --- Správa vazeb mezi agendou a službou ---

export function addServiceLink(agendaId) {
    const agenda = findItemById(state.data, agendaId);
    if (!agenda) return;

    const linkedServicesRaw = agenda.details?.['Regulované služby']?.linksTo;
    const linkedIds = Array.isArray(linkedServicesRaw) ? linkedServicesRaw : (linkedServicesRaw ? [linkedServicesRaw] : []);

    const availableServices = state.services
        .filter(s => !linkedIds.includes(s.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (availableServices.length === 0) {
        alert("Všechny dostupné služby jsou již propojeny.");
        return;
    }

    const promptMessage = "Vyberte službu k propojení (zadejte číslo):\n\n" +
        availableServices.map((s, index) => `${index + 1}: ${s.name}`).join('\n');
    
    const choice = prompt(promptMessage);
    const choiceIndex = parseInt(choice, 10) - 1;

    if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < availableServices.length) {
        const serviceToAdd = availableServices[choiceIndex];
        const newLinks = [...linkedIds, serviceToAdd.id];
        
        const updatedDetails = {
            ...agenda.details,
            'Regulované služby': {
                ...(agenda.details['Regulované služby'] || {}),
                linksTo: newLinks
            }
        };

        showLoading();
        updateAgenda(agendaId, { details: updatedDetails })
            .then(() => {
                // Lokální aktualizace stavu pro okamžitou odezvu
                agenda.details = updatedDetails;
                renderDetails(agenda);
            })
            .catch(error => console.error('Chyba při přidávání vazby:', error))
            .finally(hideLoading);
    }
}

export function removeServiceLink(agendaId, serviceIdToRemove) {
    const agenda = findItemById(state.data, agendaId);
    if (!agenda || !agenda.details || !agenda.details['Regulované služby']) return;

    const linkedServicesRaw = agenda.details['Regulované služby'].linksTo;
    const linkedIds = Array.isArray(linkedServicesRaw) ? linkedServicesRaw : (linkedServicesRaw ? [linkedServicesRaw] : []);
    
    const newLinks = linkedIds.filter(id => id !== serviceIdToRemove);

    const updatedDetails = {
        ...agenda.details,
        'Regulované služby': {
            ...agenda.details['Regulované služby'],
            linksTo: newLinks
        }
    };
    
    showLoading();
    updateAgenda(agendaId, { details: updatedDetails })
        .then(() => {
            // Lokální aktualizace stavu
            agenda.details = updatedDetails;
            renderDetails(agenda);
        })
        .catch(error => console.error('Chyba při odebírání vazby:', error))
        .finally(hideLoading);
}


// --- Správa podpůrných aktiv ---

export function addSupportAsset() {
    const assetName = prompt("Zadejte název nového podpůrného aktiva:");
    if (assetName) {
        showLoading();
        createSupportAsset({ name: assetName, type: 'podpurne-aktivum-is', details: {} })
            .then(() => location.reload())
            .catch(error => console.error('Chyba při vytváření podpůrného aktiva:', error))
            .finally(hideLoading);
    }
}

export function editSupportAsset(assetId) {
    const asset = findItemById(state.data, assetId);
    if (asset) {
        const newName = prompt("Zadejte nový název podpůrného aktiva:", asset.name);
        if (newName && newName !== asset.name) {
            showLoading();
            updateSupportAsset(assetId, { name: newName })
                .then(() => location.reload())
                .catch(error => console.error('Chyba při aktualizaci podpůrného aktiva:', error))
                .finally(hideLoading);
        }
    }
}

export function removeSupportAsset(assetId) {
    if (confirm("Opravdu chcete smazat toto podpůrné aktivum?")) {
        showLoading();
        deleteSupportAsset(assetId)
            .then(() => location.reload())
            .catch(error => console.error('Chyba při mazání podpůrného aktiva:', error))
            .finally(hideLoading);
    }
}

// --- Správa uživatelů ---

export function showUsers() {
    showLoading();
    getUsers()
        .then(users => renderUsers(users))
        .catch(error => console.error('Chyba při načítání uživatelů:', error))
        .finally(hideLoading);
}

export function addUser() {
    const email = prompt("Zadejte email nového uživatele:");
    if (email) {
        const password = prompt("Zadejte heslo pro nového uživatele:");
        if (password) {
            showLoading();
            createUser({ email, password, role: 'editor' })
                .then(() => showUsers())
                .catch(error => console.error('Chyba při vytváření uživatele:', error))
                .finally(hideLoading);
        }
    }
}

export function editUser(uid, currentRole) {
    const newRole = prompt("Zadejte novou roli (administrator/editor):", currentRole);
    if (newRole && (newRole === 'administrator' || newRole === 'editor')) {
        showLoading();
        updateUser(uid, { role: newRole })
            .then(() => showUsers())
            .catch(error => console.error('Chyba při aktualizaci uživatele:', error))
            .finally(hideLoading);
    }
}

export function removeUser(uid) {
    if (confirm("Opravdu chcete smazat tohoto uživatele?")) {
        showLoading();
        deleteUser(uid)
            .then(() => showUsers())
            .catch(error => console.error('Chyba při mazání uživatele:', error))
            .finally(hideLoading);
    }
}

// --- Export dat ---

export function exportData() {
    showLoading();
    apiExportData()
        .then(data => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "data-export.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        })
        .catch(error => console.error('Chyba při exportu dat:', error))
        .finally(hideLoading);
}
