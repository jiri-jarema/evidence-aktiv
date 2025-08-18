// js/dom.js
import { state } from './state.js';

const treeContainer = document.getElementById('assets-tree');
const detailsContainer = document.getElementById('asset-details');

export function renderTree() {
    treeContainer.innerHTML = createTreeHTML(state.data);
    treeContainer.querySelectorAll('.asset-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.parentElement.tagName === 'BUTTON') return;
            
            const id = item.dataset.id;
            const asset = findItemById(state.data, id);
            if (asset) {
                renderDetails(asset);
            }
        });
    });
}

function createTreeHTML(node) {
    if (!node || !node.children) return '';
    let html = '<ul>';
    for (const key in node.children) {
        const child = { id: key, ...node.children[key] };
        const hasChildren = child.children && Object.keys(child.children).length > 0;
        
        html += `<li class="ml-4">`;
        html += `<div class="flex items-center justify-between p-1 rounded hover:bg-gray-200">`;
        html += `<span class="asset-item cursor-pointer font-semibold" data-id="${child.id}">${child.name}</span>`;
        if (state.userRole === 'administrator') {
            html += `<div>${getEditButtons(child)}</div>`;
        }
        html += `</div>`;

        if (hasChildren) {
            html += createTreeHTML(child);
        }
        html += '</li>';
    }
    html += '</ul>';
    return html;
}

function getEditButtons(item) {
    let buttons = '';
    const type = item.type;

    if (type && type.includes('sluzba')) {
        buttons += `<button onclick="editService('${item.id}')" class="text-xs bg-yellow-500 text-white p-1 rounded mr-1">Upravit</button>`;
        buttons += `<button onclick="removeService('${item.id}')" class="text-xs bg-red-500 text-white p-1 rounded">Smazat</button>`;
    } else if (type === 'agenda') {
         buttons += `<button onclick="editAgenda('${item.id}')" class="text-xs bg-yellow-500 text-white p-1 rounded mr-1">Upravit</button>`;
         buttons += `<button onclick="removeAgenda('${item.id}')" class="text-xs bg-red-500 text-white p-1 rounded">Smazat</button>`;
    } else if (type && type.includes('podpurne-aktivum')) {
         buttons += `<button onclick="editSupportAsset('${item.id}')" class="text-xs bg-yellow-500 text-white p-1 rounded mr-1">Upravit</button>`;
         buttons += `<button onclick="removeSupportAsset('${item.id}')" class="text-xs bg-red-500 text-white p-1 rounded">Smazat</button>`;
    }
    
    if (item.id === 'agendy') {
        buttons += `<button onclick="addAgenda()" class="text-xs bg-green-500 text-white p-1 rounded ml-2" title="Přidat novou agendu">+</button>`;
    }
    if (item.id === 'podpurna-aktiva-is') {
        buttons += `<button onclick="addSupportAsset()" class="text-xs bg-green-500 text-white p-1 rounded ml-2" title="Přidat podpůrné aktivum">+</button>`;
    }
    if (item.id === 'sluzby') {
        buttons += `<button onclick="createService()" class="text-xs bg-green-500 text-white p-1 rounded ml-2" title="Přidat novou službu">+</button>`;
    }

    return buttons;
}

export function renderDetails(asset) {
    let html = `<h3 class="text-xl font-bold mb-2">${asset.name}</h3>`;
    html += `<p class="text-sm text-gray-500 mb-4">ID: ${asset.id} | Typ: ${asset.type || 'N/A'}</p>`;
    
    if (asset.details) {
        html += '<h4 class="font-semibold mt-4 border-b pb-1 mb-2">Detaily:</h4>';
        html += '<dl class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">';
        for (const key in asset.details) {
            // Přeskočíme renderování vazeb zde, protože je budeme renderovat speciálně
            if (key === 'Regulované služby') continue;

            const detail = asset.details[key];
            html += `<div class="bg-gray-50 p-2 rounded">`;
            html += `<dt class="text-sm font-medium text-gray-500">${key}</dt>`;
            if (detail.linksTo) {
                const linkedItems = [].concat(detail.linksTo).map(id => {
                    const item = findItemById(state.data, id);
                    return item ? item.name : `<span class="text-red-500">Nenalezeno (${id})</span>`;
                }).join(', ');
                html += `<dd class="mt-1 text-sm text-gray-900">${linkedItems}</dd>`;
            } else {
                html += `<dd class="mt-1 text-sm text-gray-900">${detail.value || 'N/A'}</dd>`;
            }
            html += `</div>`;
        }
        html += '</dl>';
    }

    // Speciální renderování pro vazby agend na regulované služby
    if (asset.type === 'agenda' && state.userRole === 'administrator') {
        html += '<h4 class="font-semibold mt-6 border-b pb-1 mb-2">Propojené regulované služby</h4>';
        
        const linkedServices = asset.details?.['Regulované služby']?.linksTo;
        const linkedIds = Array.isArray(linkedServices) ? linkedServices : (linkedServices ? [linkedServices] : []);

        if (linkedIds.length > 0) {
            html += '<ul>';
            linkedIds.forEach(serviceId => {
                const service = findItemById(state.data, serviceId);
                if (service) {
                    html += `<li class="flex justify-between items-center p-2 hover:bg-gray-100 rounded">
                                <span>${service.name}</span>
                                <button onclick="removeServiceLink('${asset.id}', '${serviceId}')" class="text-xs bg-red-500 text-white py-1 px-2 rounded">Odebrat vazbu</button>
                             </li>`;
                }
            });
            html += '</ul>';
        } else {
            html += '<p class="text-sm text-gray-500">Tato agenda nemá žádné propojené služby.</p>';
        }

        html += `<button onclick="addServiceLink('${asset.id}')" class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Přidat vazbu na službu</button>`;
    }

    detailsContainer.innerHTML = html;
}

export function renderUsers(users) {
    let html = `
        <h2 class="text-2xl font-bold mb-4">Správa uživatelů</h2>
        <button onclick="addUser()" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4">Přidat uživatele</button>
        <table class="min-w-full bg-white">
            <thead>
                <tr>
                    <th class="py-2 px-4 border-b">Email</th>
                    <th class="py-2 px-4 border-b">Role</th>
                    <th class="py-2 px-4 border-b">Akce</th>
                </tr>
            </thead>
            <tbody>
    `;
    users.forEach(user => {
        html += `
            <tr>
                <td class="py-2 px-4 border-b">${user.email}</td>
                <td class="py-2 px-4 border-b">${user.role}</td>
                <td class="py-2 px-4 border-b">
                    <button onclick="editUser('${user.uid}', '${user.role}')" class="bg-yellow-500 text-white p-1 rounded text-xs">Upravit</button>
                    <button onclick="removeUser('${user.uid}')" class="bg-red-500 text-white p-1 rounded text-xs ml-1">Smazat</button>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    detailsContainer.innerHTML = html;
}

export function findItemById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    if (node.children) {
        for (const key in node.children) {
            const child = { id: key, ...node.children[key] };
            const found = findItemById(child, id);
            if (found) return found;
        }
    }
    return null;
}

export function flattenServices(servicesNode) {
    let services = [];
    if (servicesNode && servicesNode.children) {
        for (const categoryKey in servicesNode.children) {
            const category = servicesNode.children[categoryKey];
            if (category.children) {
                for (const serviceKey in category.children) {
                    services.push({ id: serviceKey, ...category.children[serviceKey] });
                }
            }
        }
    }
    return services;
}
