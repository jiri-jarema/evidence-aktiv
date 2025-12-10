import * as dom from './dom.js';
import * as state from './state.js';
import * as utils from './utils.js';
import * as api from './api.js';
import { reloadDataAndRebuildUI } from './auth.js';

const loadingOverlay = document.getElementById('loading-overlay');

// Centralizovaný seznam polí, která se mají vykreslovat jako výběrové seznamy (vazby)
const LINK_FIELDS = [
    'Agendy',
    'Aplikační server',
    'Databáze',
    'Databaze',
    'Sítě',
    'Server',
    'Cil_zalohovani',
    'Provozovane_databaze',
    'Provozovane_informacni_systemy',
    'Informacni_systemy_vyuzivajici_DB',
    'Informacni_systemy',
    'Regulované služby',
    'Zalohovane_databaze',
    'Regulovaná služba',
    'Agendový informační systém'
];

function showLoader() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoader() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

// Pomocná funkce pro zjištění, zda má informatik právo na editaci dané kategorie
function isAssetCategoryAllowedForInformatik(categoryId, assetPath) {
    // Kategorie, které může informatik spravovat
    const allowedIds = ['informacni-systemy', 'databaze', 'servery', 'site'];
    
    // Pokud je to přímo jedna z hlavních kategorií
    if (allowedIds.includes(categoryId)) return true;

    // Pokud je asset uvnitř jedné z těchto kategorií (kontrola cesty)
    if (assetPath) {
        if (assetPath.includes('primarni/children/informacni-systemy') ||
            assetPath.includes('podpurna/children/databaze') ||
            assetPath.includes('podpurna/children/servery') ||
            assetPath.includes('podpurna/children/site')) {
            return true;
        }
    }
    return false;
}

/**
 * Calculates the maximum classification level from linked agendas.
 * Hierarchy: VEŘEJNÉ (0) < INTERNÍ (1) < CITLIVÉ (2) < CHRÁNĚNÉ (3)
 * @param {object} asset - The asset object (Information System).
 * @returns {string} - The highest classification level string.
 */
function calculateMaxClassification(asset) {
    if (!asset) return "VEŘEJNÉ";
    
    const levels = { "VEŘEJNÉ": 0, "INTERNÍ": 1, "CITLIVÉ": 2, "CHRÁNĚNÉ": 3 };
    const levelsArray = ["VEŘEJNÉ", "INTERNÍ", "CITLIVÉ", "CHRÁNĚNÉ"];
    
    let maxLevel = 0;
    
    // Získání odkazů na agendy - u IS je to v details.Agendy.linksTo
    const linkedAgendas = asset.details?.Agendy?.linksTo || [];
    const allAssets = state.getAllAssets();

    linkedAgendas.forEach(agendaId => {
        const agenda = allAssets[agendaId];
        // Zkontrolujeme, zda agenda existuje a zda má nastavenou klasifikaci
        if (agenda && agenda.details && agenda.details["Klasifikace informací"]) {
            const val = agenda.details["Klasifikace informací"].value;
            if (levels[val] !== undefined) {
                if (levels[val] > maxLevel) {
                    maxLevel = levels[val];
                }
            }
        }
    });

    return levelsArray[maxLevel];
}


/**
 * Displays a custom confirmation modal.
 */
function showConfirmationModal(message, onConfirm) {
    const existingModal = document.getElementById('confirmation-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'confirmation-modal';
    modalOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    const modalContent = document.createElement('div');
    modalContent.className = 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full';

    const messageP = document.createElement('p');
    messageP.className = 'text-lg mb-4';
    messageP.textContent = message;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-4';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Zrušit';
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.onclick = () => modalOverlay.remove();

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Potvrdit smazání';
    confirmButton.className = 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700';
    confirmButton.onclick = async () => {
        modalOverlay.remove();
        showLoader();
        try {
            await onConfirm();
        } catch (error) {
            console.error("Confirmation action failed:", error);
            alert("Akce se nezdařila.");
        } finally {
            hideLoader();
        }
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    modalContent.appendChild(messageP);
    modalContent.appendChild(buttonContainer);
    modalOverlay.appendChild(modalContent);

    document.body.appendChild(modalOverlay);
}


/**
 * Builds the navigation sidebar.
 */
export function buildNav(data, parentElement, level = 0, parentKey = null) {
  if (level === 0) {
      const toolsSection = document.createElement('div');
      toolsSection.className = 'mb-4';

      const btnReport = document.createElement('button');
      btnReport.id = 'nav-btn-services-report';
      btnReport.innerHTML = `
        <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Přehled regulovaných služeb
        </span>`;
      btnReport.className = 'w-full text-left px-3 py-2 rounded hover:bg-gray-100 font-medium text-gray-700 mb-1';
      btnReport.onclick = () => renderServicesReport();
      toolsSection.appendChild(btnReport);

      const userRole = state.getUserRole();
      if (userRole === 'administrator') {
        const btnUsers = document.createElement('button');
        btnUsers.id = 'nav-btn-users';
        btnUsers.innerHTML = `
            <span class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Správa uživatelů
            </span>`;
        btnUsers.className = 'w-full text-left px-3 py-2 rounded hover:bg-gray-100 font-medium text-gray-700';
        btnUsers.onclick = () => renderUsersAdminPage();
        toolsSection.appendChild(btnUsers);
      }

      parentElement.appendChild(toolsSection);

      const hr = document.createElement('hr');
      hr.className = 'my-4';
      parentElement.appendChild(hr);
  }

    if (level >= 2) return;
    const ul = document.createElement('ul');
    if (level > 0) ul.style.paddingLeft = `${(level - 1) * 16}px`;
    
    let keys = Object.keys(data);
    
    if (parentKey === 'sluzby') {
        keys.sort((a, b) => data[a].name.localeCompare(data[b].name, 'cs'));
    }

    for (const key of keys) {
        const item = data[key];
        const li = document.createElement('li');
        const itemDiv = document.createElement('div');
        itemDiv.textContent = item.name;
        itemDiv.dataset.id = key;
        itemDiv.className = level === 0 ? 'font-bold text-lg mt-4 cursor-default' : 'p-2 rounded-md sidebar-item';

        if (level > 0 && (item.children || !item.details)) { 
            itemDiv.onclick = () => showCategoryContent(key);
        } else if (level > 0) {
            itemDiv.onclick = () => showAssetDetails(key, utils.findParentId(key));
        }

        li.appendChild(itemDiv);
        if (item.children) buildNav(item.children, li, level + 1, key);
        ul.appendChild(li);
    }
    parentElement.appendChild(ul);
}

export function showCategoryContent(categoryId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[categoryId];

    if (!asset) {
        console.error(`Asset with ID ${categoryId} not found.`);
        return;
    }
    
    const hasChildren = asset.children && (typeof asset.children === 'object') && Object.keys(asset.children).length > 0;

    if (asset.details && !hasChildren) {
        showAssetDetails(categoryId, utils.findParentId(categoryId));
        return;
    }

    dom.welcomeMessage.classList.add('hidden');
    dom.assetDetailContainer.classList.remove('hidden');
    dom.assetDetailContainer.innerHTML = '';
    document.querySelectorAll('.sidebar-item.active, #nav-btn-users.active, #nav-btn-services-report.active').forEach(el => el.classList.remove('active'));
    document.querySelector(`.sidebar-item[data-id="${categoryId}"]`)?.classList.add('active');

    const parentId = utils.findParentId(categoryId);

    if (parentId && allAssets[parentId]) {
        const parentAsset = allAssets[parentId];
        const breadcrumbs = document.createElement('div');
        breadcrumbs.className = 'mb-4 text-sm';

        const parentLink = document.createElement('a');
        parentLink.className = 'asset-link';
        parentLink.textContent = parentAsset.name;
        parentLink.onclick = (e) => {
            e.stopPropagation();
            showCategoryContent(parentId);
        };
        breadcrumbs.appendChild(parentLink);

        const separator = document.createElement('span');
        separator.className = 'mx-2 text-gray-400';
        separator.textContent = '/';
        breadcrumbs.appendChild(separator);

        const currentAssetText = document.createElement('span');
        currentAssetText.className = 'text-gray-600';
        currentAssetText.textContent = asset.name;
        breadcrumbs.appendChild(currentAssetText);

        dom.assetDetailContainer.appendChild(breadcrumbs);
    }

    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex justify-between items-center border-b border-gray-300 mb-6 pb-2';

    const title = document.createElement('h2');
    title.textContent = asset.name;
    title.className = 'text-3xl font-bold';
    titleContainer.appendChild(title);

    const userRole = state.getUserRole();
    const userOdbor = state.getUserOdbor();
    const assetPath = utils.getPathForAsset(categoryId);
    
    if (categoryId === 'sluzby' && userRole === 'administrator') {
        const addButton = document.createElement('button');
        addButton.textContent = 'Přidat novou kategorii služeb';
        addButton.className = 'px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600';
        addButton.onclick = () => renderNewServiceCategoryForm(categoryId);
        titleContainer.appendChild(addButton);
    } else if (parentId === 'sluzby' && userRole === 'administrator') {
        const addButton = document.createElement('button');
        addButton.textContent = 'Přidat novou službu';
        addButton.className = 'px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600';
        addButton.onclick = () => renderNewServiceForm(categoryId);
        titleContainer.appendChild(addButton);
    } else if (parentId === 'agendy') {
        // Agendy (úroveň odboru)
        if (userRole === 'administrator' || (userRole === 'garant' && userOdbor === categoryId)) {
             const addButton = document.createElement('button');
             addButton.textContent = 'Přidat novou agendu';
             addButton.className = 'px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 ml-2';
             addButton.onclick = () => renderNewAgendaForm(categoryId);
             titleContainer.appendChild(addButton);
        }
        
        // Tlačítko pro úpravu odboru (včetně Garanta odboru)
        if (userRole === 'administrator') {
             const editOdborButton = document.createElement('button');
             editOdborButton.textContent = 'Upravit odbor';
             editOdborButton.className = 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 ml-2';
             editOdborButton.onclick = () => renderEditDepartmentForm(categoryId);
             titleContainer.appendChild(editOdborButton);
        }

    } else if (parentId === 'primarni' || parentId === 'podpurna') {
        // Kontrola oprávnění pro přidávání (Administrator nebo Informatik pro povolené kategorie)
        const canAdd = userRole === 'administrator' || 
                       (userRole === 'informatik' && isAssetCategoryAllowedForInformatik(categoryId));

        if (canAdd && categoryId !== 'sluzby') {
            const addButton = document.createElement('button');
            addButton.textContent = `Přidat do ${asset.name}`;
            addButton.className = 'px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600';
            addButton.onclick = () => renderNewSupportAssetForm(categoryId);
            titleContainer.appendChild(addButton);
        }
    }

    dom.assetDetailContainer.appendChild(titleContainer);

    // Zobrazení Garanta odboru (pokud jsme na úrovni odboru)
    if (parentId === 'agendy' && asset.details) {
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'mb-6 p-4 bg-gray-50 rounded border border-gray-200';
        if (asset.details.Garant && asset.details.Garant.value) {
            detailsDiv.innerHTML = `<span class="font-bold text-gray-700">Garant odboru:</span> ${asset.details.Garant.value}`;
        } else {
            detailsDiv.innerHTML = `<span class="text-gray-500 italic">Garant odboru není nastaven.</span>`;
        }
        dom.assetDetailContainer.appendChild(detailsDiv);
    }

    const listContainer = document.createElement('div');
    listContainer.className = 'flex flex-col space-y-2';
    if (asset.children) {
        for (const childId in asset.children) {
            const childAsset = asset.children[childId];
            const listItem = document.createElement('div');
            listItem.className = 'bg-white p-4 rounded-md hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200';
            listItem.innerHTML = `<h3 class="font-semibold text-blue-600">${childAsset.name}</h3>`;

            if (childAsset.children || !childAsset.details) {
                listItem.onclick = () => showCategoryContent(childId);
            } else {
                listItem.onclick = () => showAssetDetails(childId, categoryId);
            }

            listContainer.appendChild(listItem);
        }
    }
    dom.assetDetailContainer.appendChild(listContainer);
}

export function showAssetDetails(assetId, parentId, changedKeys = []) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    if (!asset) return;

    dom.welcomeMessage.classList.add('hidden');
    dom.assetDetailContainer.classList.remove('hidden');
    dom.assetDetailContainer.innerHTML = '';
    document.querySelectorAll('.sidebar-item.active, #nav-btn-users.active, #nav-btn-services-report.active').forEach(el => el.classList.remove('active'));

    const navItem = document.querySelector(`.sidebar-item[data-id="${assetId}"]`);
    if (navItem) {
      navItem.classList.add('active');
    } else {
      const parentNavItem = document.querySelector(`.sidebar-item[data-id="${parentId}"]`);
      if(parentNavItem) parentNavItem.classList.add('active');
    }


    if (parentId && allAssets[parentId]) {
        const parentAsset = allAssets[parentId];
        const breadcrumbs = document.createElement('div');
        breadcrumbs.className = 'mb-4 text-sm';

        const grandparentId = utils.findParentId(parentId);
        if (grandparentId && allAssets[grandparentId]) {
            const grandparentAsset = allAssets[grandparentId];
            const grandparentLink = document.createElement('a');
            grandparentLink.className = 'asset-link';
            grandparentLink.textContent = grandparentAsset.name;
            grandparentLink.onclick = (e) => {
                e.stopPropagation();
                showCategoryContent(grandparentId);
            };
            breadcrumbs.appendChild(grandparentLink);

            const separator1 = document.createElement('span');
            separator1.className = 'mx-2 text-gray-400';
            separator1.textContent = '/';
            breadcrumbs.appendChild(separator1);
        }

        const parentLink = document.createElement('a');
        parentLink.className = 'asset-link';
        parentLink.textContent = parentAsset.name;
        parentLink.onclick = (e) => {
            e.stopPropagation();
            showCategoryContent(parentId);
        };

        const separator2 = document.createElement('span');
        separator2.className = 'mx-2 text-gray-400';
        separator2.textContent = '/';

        const currentAssetText = document.createElement('span');
        currentAssetText.className = 'text-gray-600';
        currentAssetText.textContent = asset.name;

        breadcrumbs.appendChild(parentLink);
        breadcrumbs.appendChild(separator2);
        breadcrumbs.appendChild(currentAssetText);
        dom.assetDetailContainer.appendChild(breadcrumbs);
    }

    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex justify-between items-center border-b border-gray-300 mb-6 pb-2';
    const title = document.createElement('h2');
    title.textContent = asset.name;
    title.className = 'text-3xl font-bold';
    titleContainer.appendChild(title);

    const assetPath = utils.getPathForAsset(assetId);
    const isAgenda = assetPath.startsWith('agendy');
    const isService = asset.type === 'jednotliva-sluzba';
    const isSupportOrPrimary = !isAgenda && !isService;
    const userRole = state.getUserRole();
    const userOdbor = state.getUserOdbor();

    let canEdit = false;
    if (isAgenda && (userRole === 'administrator' || (userRole === 'garant' && userOdbor === parentId))) {
        canEdit = true;
    } else if ((isSupportOrPrimary || isService) && userRole === 'administrator') {
        canEdit = true;
    } else if (isSupportOrPrimary && userRole === 'informatik' && isAssetCategoryAllowedForInformatik(null, assetPath)) {
        canEdit = true;
    }

    if (canEdit) {
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'flex space-x-2';

        const editButton = document.createElement('button');
        editButton.textContent = 'Upravit';
        editButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
        if (isAgenda) {
            editButton.onclick = () => renderEditForm(assetId);
        } else {
            editButton.onclick = () => renderSupportAssetEditForm(assetId);
        }
        buttonGroup.appendChild(editButton);

        // Mazání povoleno pro Admina (vše) a Informatik (jen podporovaná aktiva)
        let canDelete = false;
        if (isAgenda && userRole === 'administrator') {
            canDelete = true;
        } else if (isSupportOrPrimary && (userRole === 'administrator' || (userRole === 'informatik' && isAssetCategoryAllowedForInformatik(null, assetPath)))) {
            canDelete = true;
        }

        if (canDelete) {
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Smazat';
            deleteButton.className = 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700';
            deleteButton.onclick = () => {
                showConfirmationModal(`Opravdu si přejete smazat "${asset.name}"? Tato akce je nevratná.`, async () => {
                    let success = false;
                    if (isAgenda) {
                        success = await api.deleteAgenda(assetId);
                    } else {
                        // Vylepšené mazání aktiv s kontrolou a odstraněním vazeb
                        const reciprocalLinks = utils.getReciprocalLinksForDeletion(assetId);
                        success = await api.deleteAsset(assetId, reciprocalLinks);
                    }
                    
                    if (success) {
                        const reloaded = await reloadDataAndRebuildUI();
                        if (reloaded) {
                            showCategoryContent(parentId); 
                        }
                    }
                });
            };
            buttonGroup.appendChild(deleteButton);
        }

        titleContainer.appendChild(buttonGroup);
    }
    dom.assetDetailContainer.appendChild(titleContainer);

    renderGenericDetails(asset, assetId, changedKeys);
}


// --- Rendering Detail Views ---

function renderGenericDetails(asset, assetId, changedKeys = []) {
    const detailsGrid = document.createElement('dl');
    detailsGrid.className = 'details-grid';
    const sharedOptions = state.getSharedOptions();
    
    // Determine keys to render
    const assetPath = utils.getPathForAsset(assetId);
    const isAgenda = assetPath.startsWith('agendy');
    const isService = asset.type === 'jednotliva-sluzba';
    const isInfoSystem = assetPath.startsWith('primarni/children/informacni-systemy');

    // Změna: Detekce databáze a sítě
    const isDatabase = assetPath.includes('podpurna/children/databaze');
    const isNetwork = assetPath.includes('podpurna/children/site');

    let keysToRender = [];
    if (isAgenda) {
        keysToRender = [...state.detailOrder];
    } else if (isService) {
        keysToRender = [...state.serviceDetailOrder];
        keysToRender.push("Agendový informační systém");
    } else if (isInfoSystem) {
        keysToRender = [...state.infoSystemDetailOrder];
        keysToRender.push("Regulovaná služba");
    } else {
        keysToRender = state.defaultSupportAssetOrder.filter(k => asset.details && asset.details[k] !== undefined);
    }

    // Změna: Odstranění Vlastník pro Databáze a Sítě
    if (isDatabase || isNetwork) {
        keysToRender = keysToRender.filter(k => k !== 'Vlastnik');
    }
    
    // Změna: Odstranění Spravce_zastupce pro Databáze
    if (isDatabase) {
        keysToRender = keysToRender.filter(k => k !== 'Spravce_zastupce');
    }

    if (keysToRender.length > 0) {
        keysToRender.forEach(key => {
            const detail = asset.details ? asset.details[key] : undefined;

            const dt = document.createElement('dt');
            dt.textContent = key.replace(/_/g, ' ');
            const dd = document.createElement('dd');

            if (changedKeys.includes(key)) {
                dd.classList.add('changed-value');
            }

            // --- ZDE JE IMPLEMENTOVÁNA LOGIKA PRO DYNAMICKÝ VÝPOČET KLASIFIKACE ---
            if (isInfoSystem && key === "Klasifikace informací") {
                const calculatedValue = calculateMaxClassification(asset);
                dd.innerHTML = `<span class="font-bold text-blue-700">${calculatedValue}</span> <span class="text-xs text-gray-500 block">(určeno automaticky dle nejvyšší klasifikace připojených agend)</span>`;
            } else if (isService && key === "Agendový informační systém") {
                const connectedAIS = utils.getConnectedAISForService(assetId);
                if (connectedAIS.length > 0) {
                     dd.appendChild(utils.createLinksFragment(connectedAIS.map(i => i.id), showAssetDetails));
                } else {
                    dd.textContent = '-';
                }
            } else if (isInfoSystem && key === "Regulovaná služba") {
                const linkedAgendas = asset.details?.Agendy?.linksTo || [];
                const services = new Set();
                const allAssets = state.getAllAssets();
                linkedAgendas.forEach(agendaId => {
                    const agenda = allAssets[agendaId];
                    const serviceLinks = agenda?.details?.['Regulované služby']?.linksTo;
                    if (serviceLinks) {
                        serviceLinks.forEach(serviceId => services.add(serviceId));
                    }
                });
                if (services.size > 0) {
                    dd.appendChild(utils.createLinksFragment(Array.from(services), showAssetDetails));
                } else {
                    dd.textContent = '-';
                }
            } else if (isAgenda && key === "Zabezpečení zpracování - elektronické") {
                const linkedSecurity = utils.getLinkedISSecurityForAgenda(assetId);
                if (linkedSecurity.length > 0) {
                    const ul = document.createElement('ul');
                    ul.className = "list-disc list-inside space-y-1";
                    linkedSecurity.forEach(isSec => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span class="font-medium text-blue-700">${isSec.name}</span>: ${isSec.options.join(', ')}`;
                        ul.appendChild(li);
                    });
                    dd.appendChild(ul);
                } else {
                    dd.textContent = "Žádná data z připojených IS.";
                }
            } else if (isAgenda && key === "Garant") {
                // --- Načítání Garanta z nadřazeného odboru ---
                const parentId = utils.findParentId(assetId);
                const allAssets = state.getAllAssets();
                const parentAsset = allAssets[parentId];
                if (parentAsset && parentAsset.details && parentAsset.details.Garant) {
                     dd.textContent = parentAsset.details.Garant.value || '-';
                } else {
                     dd.textContent = '-';
                }
            } else if (!detail) {
                dd.textContent = '-';
            } else if (detail.type === 'lawfulness') {
                dd.textContent = sharedOptions.lawfulness.find(opt => opt.startsWith(detail.value)) || detail.value || '-';
            } else if (detail.type === 'processing-methods') {
                renderProcessingMethods(detail.value, dd);
            } else if (detail.type === 'checkbox-list' && detail.optionsKey) {
                if (sharedOptions[detail.optionsKey] && detail.checked) {
                    renderCheckboxList(sharedOptions[detail.optionsKey], detail.checked, dd, detail.details);
                } else {
                     dd.textContent = '-';
                }
            } else if (detail.type === 'security') {
                renderCheckboxList(sharedOptions.securityElectronic, detail.value, dd, detail.details);
            } else if (detail.linksTo !== undefined) {
                if (detail.linksTo && detail.linksTo.length > 0) {
                    dd.appendChild(utils.createLinksFragment(detail.linksTo, showAssetDetails));
                } else {
                    dd.textContent = '-';
                }
            } else if (detail.type === 'dictionary' && typeof detail.value === 'object') {
                const subList = document.createElement('ul');
                subList.className = 'list-disc list-inside space-y-1';
                let hasContent = false;
                for (const subKey in detail.value) {
                    if (detail.value.hasOwnProperty(subKey) && detail.value[subKey]) {
                        hasContent = true;
                        const listItem = document.createElement('li');
                        listItem.innerHTML = `<span class="font-medium capitalize">${subKey.replace(/_/g, ' ')}:</span> ${detail.value[subKey]}`;
                        subList.appendChild(listItem);
                    }
                }
                if(hasContent) dd.appendChild(subList);
                else dd.textContent = '-';

            } else {
                dd.textContent = detail.value || '-';
            }
            detailsGrid.appendChild(dt);
            detailsGrid.appendChild(dd);
        });
    } else {
        detailsGrid.innerHTML = '<p class="text-gray-500 col-span-2">Pro tuto položku nejsou k dispozici žádné podrobnosti.</p>';
    }
    dom.assetDetailContainer.appendChild(detailsGrid);
}


function renderCheckboxList(options, checked, container, details) {
    options.forEach((option, index) => {
        const isChecked = checked[index];
        const optionDiv = document.createElement('div');
        optionDiv.className = 'flex items-center';

        let detailText = '';
        if (isChecked && option.toLowerCase().includes('jiné')) {
            const detailValue = details && details[index] ? details[index] : '(neuvedeno)';
            detailText = `<span class="ml-2 text-gray-600">- ${detailValue}</span>`;
        }

        optionDiv.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${isChecked ? 'text-blue-600' : 'text-gray-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                ${isChecked
                    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                    : '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />'
                }
            </svg>
            <span>${option}</span>
            ${detailText}
        `;
        container.appendChild(optionDiv);
    });
}

function renderProcessingMethods(methods, container) {
    if (!methods || methods.length === 0) {
        container.textContent = '-';
        return;
    }
    methods.forEach(method => {
        const methodDiv = document.createElement('div');
        methodDiv.className = 'flex items-start mb-1';
        const iconAndLabel = document.createElement('div');
        iconAndLabel.className = 'flex items-center flex-shrink-0';
        iconAndLabel.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 ${method.checked ? 'text-blue-600' : 'text-gray-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                 ${method.checked
                    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                    : '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />'
                }
            </svg>
            <span>${method.label}</span>
        `;
        methodDiv.appendChild(iconAndLabel);
        if (method.checked && (method.details || (method.linksTo && method.linksTo.length > 0))) {
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'ml-2 text-gray-600';

            if (method.details) {
                const textNode = document.createTextNode(`- ${method.details}`);
                detailsContainer.appendChild(textNode);
            } else if (method.linksTo) {
                detailsContainer.appendChild(utils.createLinksFragment(method.linksTo, showAssetDetails));
            }
            methodDiv.appendChild(detailsContainer);
        }
        container.appendChild(methodDiv);
    });
}


// --- Rendering Edit Forms ---

function createDetailsForForm(categoryId, existingDetails, detailOrder) {
    const allAssets = state.getAllAssets();
    const category = allAssets[categoryId];
    const detailsForForm = {};

    const sampleAsset = (category && category.children && Object.keys(category.children).length > 0) 
        ? Object.values(category.children)[0] 
        : null;
    
    // Fallback default structure for a new agenda
    const defaultAgendaStructure = {
        'Lhůty pro výmaz': { type: 'dictionary', value: { 'skartační lhůta': '', 'spisový znak': '', 'ukončení zpracování': '' } },
        'Způsob zpracování': {
            type: 'processing-methods',
            value: [
                { checked: false, label: 'agendový informační systém (AIS)', linksTo: [] },
                { checked: false, label: 'soubory na síťovém úložišti', details: '' },
                { checked: false, label: 'soubory na lokálním úložišti', details: '' },
                { checked: false, label: 'soubory na přenosném úložišti', details: '' },
                { checked: false, label: 'jiné elektronické', details: '' },
                { checked: false, label: 'analogové', details: '' }
            ]
        },
        'Regulované služby': { linksTo: [] }
    };

    for (const key of detailOrder) {
        if (existingDetails && existingDetails[key] !== undefined) {
            detailsForForm[key] = JSON.parse(JSON.stringify(existingDetails[key]));
            
            // OPRAVA: Pokud je pole vazební, musíme zajistit existenci pole linksTo
            // Důležité pro případy, kdy byla data vytvořena dříve bez struktury linksTo
            if (LINK_FIELDS.includes(key) || LINK_FIELDS.includes(key.replace(/_/g, ' '))) {
                if (detailsForForm[key].linksTo === undefined) {
                    detailsForForm[key].linksTo = [];
                }
            }
            continue;
        }

        // --- NOVÝ KÓD PRO KLASIFIKACI A SUBJEKTY ---
        if (key === "Klasifikace informací") {
            detailsForForm[key] = { 
                type: 'classification', 
                value: 'INTERNÍ' 
            };
            continue;
        }

        if (key === "Kategorie subjektu údajů") {
            const options = state.getSharedOptions().subjectCategories || ["občané/klienti", "zaměstnanci správce", "dodavatelé", "zastupitelé", "jiné"];
            detailsForForm[key] = {
                type: 'checkbox-list',
                optionsKey: 'subjectCategories', 
                checked: new Array(options.length).fill(false),
                details: {}
            };
            continue;
        }
        // --- KONEC NOVÉHO KÓDU ---

        if (sampleAsset && sampleAsset.details && sampleAsset.details[key] !== undefined) {
            const template = JSON.parse(JSON.stringify(sampleAsset.details[key]));
            
            // Reset values to blank
            if (Array.isArray(template.value)) { // Handle processing-methods array
                 template.value.forEach(v => {
                    v.checked = false;
                    if (v.details !== undefined) v.details = '';
                    if (v.linksTo !== undefined) v.linksTo = [];
                });
            } else if (template.type === 'dictionary' && typeof template.value === 'object') { // Handle dictionary
                for (const subKey in template.value) {
                    template.value[subKey] = '';
                }
            } else if (template.value !== undefined) { // Handle simple string value
                template.value = '';
            }

            if (template.linksTo !== undefined) template.linksTo = [];
            if (template.checked !== undefined && Array.isArray(template.checked)) {
                 template.checked.fill(false);
                 if (template.details) {
                    template.details = {};
                 }
            }
            
            // OPRAVA: Pokud je pole vazební, musíme vynutit existenci pole linksTo, 
            // i když ho vzorový asset (sampleAsset) nemá (např. má jen "value").
            if (LINK_FIELDS.includes(key) || LINK_FIELDS.includes(key.replace(/_/g, ' '))) {
                if (template.linksTo === undefined) {
                    template.linksTo = [];
                }
            }

            detailsForForm[key] = template;
            continue;
        }
        
        if (defaultAgendaStructure[key]) {
            detailsForForm[key] = JSON.parse(JSON.stringify(defaultAgendaStructure[key]));
            continue;
        }

        // OPRAVA: Rozšířená kontrola LINK_FIELDS - kontroluje i klíč s podtržítky
        if (LINK_FIELDS.includes(key) || LINK_FIELDS.includes(key.replace(/_/g, ' '))) {
            detailsForForm[key] = { linksTo: [] };
            continue;
        }

        // Fallback for any other missing fields
        if (!detailsForForm[key]) {
            detailsForForm[key] = { value: '' };
        }
    }

    return detailsForForm;
}


function renderNewAgendaForm(odborId) {
    dom.assetDetailContainer.innerHTML = '';
    const allAssets = state.getAllAssets();
    const odborName = allAssets[odborId].name;

    const title = document.createElement('h2');
    title.textContent = `Nová agenda pro: ${odborName}`;
    title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
    dom.assetDetailContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = `form-new-agenda-${odborId}`;
    form.className = 'edit-form-grid';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Název agendy';
    nameLabel.htmlFor = 'input-new-agenda-name';
    const nameInputContainer = document.createElement('div');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'input-new-agenda-name';
    nameInput.className = 'form-input';
    nameInput.required = true;
    nameInputContainer.appendChild(nameInput);
    form.appendChild(nameLabel);
    form.appendChild(nameInputContainer);

    const emptyDetails = createDetailsForForm(odborId, {}, state.detailOrder);

    const formElements = document.createDocumentFragment();
    renderEditFormFields(formElements, 'new-agenda', emptyDetails, state.detailOrder, { isNewAgenda: true, odborId: odborId });
    form.appendChild(formElements);
    dom.assetDetailContainer.appendChild(form);

    // Initialize AIS dropdown logic
    const zpDetail = emptyDetails["Způsob zpracování"];
    if (zpDetail && zpDetail.value) {
        const aisMethod = zpDetail.value.find(m => m.label.includes("agendový informační systém"));
        if (aisMethod) {
            const linkedSystemsContainer = document.getElementById(`linked-systems-new-agenda`);
            const selectEl = document.getElementById(`is-select-new-agenda`);
            const addButton = selectEl.nextElementSibling;
            const assetData = state.getAssetData();

            const addLinkedSystem = (container, systemId, systemName) => {
                const systemDiv = document.createElement('div');
                systemDiv.className = 'flex items-center justify-between p-1';
                systemDiv.dataset.systemId = systemId;
                const nameSpan = document.createElement('span');
                nameSpan.textContent = systemName;
                const removeButton = document.createElement('button');
                removeButton.textContent = 'Odebrat';
                removeButton.className = 'px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600';
                removeButton.type = 'button';
                removeButton.onclick = () => {
                    systemDiv.remove();
                    updateAddSystemDropdown();
                };
                systemDiv.appendChild(nameSpan);
                systemDiv.appendChild(removeButton);
                container.appendChild(systemDiv);
            };

            const updateAddSystemDropdown = () => {
                const currentlyLinkedIds = Array.from(linkedSystemsContainer.children).map(div => div.dataset.systemId);
                selectEl.innerHTML = '<option value="">Vyberte systém...</option>';
                const allSystems = assetData.primarni.children['informacni-systemy'].children;
                for (const systemId in allSystems) {
                    if (!currentlyLinkedIds.includes(systemId)) {
                        const option = document.createElement('option');
                        option.value = systemId;
                        option.textContent = allSystems[systemId].name;
                        selectEl.appendChild(option);
                    }
                }
            };

            addButton.onclick = () => {
                const selectedId = selectEl.value;
                if (!selectedId) return;
                const selectedAsset = allAssets[selectedId];
                addLinkedSystem(linkedSystemsContainer, selectedId, selectedAsset.name);
                updateAddSystemDropdown();
            };
            
            updateAddSystemDropdown();
        }
    }

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit novou agendu';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.onclick = async (e) => {
        e.preventDefault();
        if (nameInput.value.trim() === '') {
            alert('Název agendy nesmí být prázdný.');
            return;
        }
        showLoader();
        try {
            const success = await saveNewAgenda(odborId);
            if (success) {
                const reloaded = await reloadDataAndRebuildUI();
                if (reloaded) {
                    showCategoryContent(odborId);
                }
            }
        } catch (error) {
            console.error("Error creating new agenda:", error);
            alert("Nepodařilo se vytvořit novou agendu.");
        } finally {
            hideLoader();
        }
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Zrušit';
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.onclick = (e) => {
        e.preventDefault();
        showCategoryContent(odborId);
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    form.appendChild(buttonContainer);
}

function renderEditForm(assetId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    const parentId = utils.findParentId(assetId);
    dom.assetDetailContainer.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = `Úprava: ${asset.name}`;
    title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
    dom.assetDetailContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = `form-${assetId}`;
    form.className = 'edit-form-grid';

    const formElements = document.createDocumentFragment();

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Název';
    nameLabel.htmlFor = `input-${assetId}-name`;
    const nameInputContainer = document.createElement('div');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `input-${assetId}-name`;
    nameInput.value = asset.name;
    nameInput.className = 'form-input';
    nameInputContainer.appendChild(nameInput);
    formElements.appendChild(nameLabel);
    formElements.appendChild(nameInputContainer);

    const detailsForForm = createDetailsForForm(parentId, asset.details, state.detailOrder);
    
    const isAgenda = utils.getPathForAsset(assetId).startsWith('agendy');

    renderEditFormFields(formElements, assetId, detailsForForm, state.detailOrder, { isAgenda: isAgenda });
    form.appendChild(formElements);
    dom.assetDetailContainer.appendChild(form);

    const zpDetail = detailsForForm["Způsob zpracování"];
    if (zpDetail && zpDetail.value) {
        const aisMethod = zpDetail.value.find(m => m.label.includes("agendový informační systém"));
        if (aisMethod) {
            const linkedSystemsContainer = document.getElementById(`linked-systems-${assetId}`);
            const selectEl = document.getElementById(`is-select-${assetId}`);
            const addButton = selectEl.nextElementSibling;
            const assetData = state.getAssetData();

            const addLinkedSystem = (container, systemId, systemName) => {
                const systemDiv = document.createElement('div');
                systemDiv.className = 'flex items-center justify-between p-1';
                systemDiv.dataset.systemId = systemId;

                const nameSpan = document.createElement('span');
                nameSpan.textContent = systemName;

                const removeButton = document.createElement('button');
                removeButton.textContent = 'Odebrat';
                removeButton.className = 'px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600';
                removeButton.type = 'button';
                removeButton.onclick = () => {
                    systemDiv.remove();
                    updateAddSystemDropdown();
                };

                systemDiv.appendChild(nameSpan);
                systemDiv.appendChild(removeButton);
                container.appendChild(systemDiv);
            };

            const updateAddSystemDropdown = () => {
                const currentlyLinkedIds = Array.from(linkedSystemsContainer.children).map(div => div.dataset.systemId);

                selectEl.innerHTML = '<option value="">Vyberte systém...</option>';
                const allSystems = assetData.primarni.children['informacni-systemy'].children;

                for (const systemId in allSystems) {
                    if (!currentlyLinkedIds.includes(systemId)) {
                        const option = document.createElement('option');
                        option.value = systemId;
                        option.textContent = allSystems[systemId].name;
                        selectEl.appendChild(option);
                    }
                }
            };

            addButton.onclick = () => {
                const selectedId = selectEl.value;
                if (!selectedId) return;
                const selectedAsset = allAssets[selectedId];
                addLinkedSystem(linkedSystemsContainer, selectedId, selectedAsset.name);
                updateAddSystemDropdown();
            };

            (aisMethod.linksTo || []).forEach(systemId => {
                if (allAssets[systemId]) {
                    addLinkedSystem(linkedSystemsContainer, systemId, allAssets[systemId].name);
                }
            });
            updateAddSystemDropdown();
        }
    }

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.onclick = async (e) => {
        e.preventDefault();
        showLoader();
        try {
            const { changedKeys, success } = await saveAgendaChanges(assetId);
            if (success) {
                const reloaded = await reloadDataAndRebuildUI();
                if (reloaded) {
                    showAssetDetails(assetId, utils.findParentId(assetId), changedKeys);
                }
            }
        } catch (error) {
            console.error("Error saving agenda:", error);
            alert("Při ukládání došlo k chybě.");
        } finally {
            hideLoader();
        }
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Zrušit';
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.onclick = (e) => {
        e.preventDefault();
        showAssetDetails(assetId, utils.findParentId(assetId));
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    form.appendChild(buttonContainer);
}

function renderSupportAssetEditForm(assetId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    const parentId = utils.findParentId(assetId);
    dom.assetDetailContainer.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = `Úprava: ${asset.name}`;
    title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
    dom.assetDetailContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = `form-${assetId}`;
    form.className = 'edit-form-grid';

    const formElements = document.createDocumentFragment();

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Název';
    nameLabel.htmlFor = `input-${assetId}-name`;
    const nameInputContainer = document.createElement('div');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `input-${assetId}-name`;
    nameInput.value = asset.name;
    nameInput.className = 'form-input';
    nameInputContainer.appendChild(nameInput);
    formElements.appendChild(nameLabel);
    formElements.appendChild(nameInputContainer);

    const isService = asset.type === 'jednotliva-sluzba';
    const isInfoSystem = utils.getPathForAsset(assetId).startsWith('primarni/children/informacni-systemy');

    // Změna: Detekce databáze a sítě pro filtrování pole 'Vlastnik'
    const assetPath = utils.getPathForAsset(assetId);
    const isDatabase = assetPath.includes('podpurna/children/databaze');
    const isNetwork = assetPath.includes('podpurna/children/site');

    let order = state.defaultSupportAssetOrder.filter(k => (asset.details && asset.details[k] !== undefined));
    if (isService) order = state.serviceDetailOrder;
    if (isInfoSystem) order = state.infoSystemDetailOrder;

    // Změna: Filtrace pole 'Vlastnik' pro DB a Sítě
    if (isDatabase || isNetwork) {
        order = order.filter(k => k !== 'Vlastnik');
    }
    
    // Změna: Filtrace pole 'Spravce_zastupce' pro DB
    if (isDatabase) {
        order = order.filter(k => k !== 'Spravce_zastupce');
    }

    const detailsForForm = createDetailsForForm(parentId, asset.details, order);

    renderEditFormFields(formElements, assetId, detailsForForm, order, { isInfoSystem });
    form.appendChild(formElements);
    dom.assetDetailContainer.appendChild(form);


    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.onclick = async (e) => {
        e.preventDefault();
        showLoader();
        try {
            const success = await saveSupportAssetChanges(assetId);
            if (success) {
                const reloaded = await reloadDataAndRebuildUI();
                if (reloaded) {
                    showAssetDetails(assetId, utils.findParentId(assetId));
                }
            }
        } catch (error) {
            console.error("Error saving support asset:", error);
            alert("Při ukládání došlo k chybě.");
        } finally {
            hideLoader();
        }
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Zrušit';
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.onclick = (e) => {
        e.preventDefault();
        showAssetDetails(assetId, utils.findParentId(assetId));
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    form.appendChild(buttonContainer);
}

function renderNewSupportAssetForm(categoryId) {
    try {
        dom.assetDetailContainer.innerHTML = '';
        const allAssets = state.getAllAssets();
        const category = allAssets[categoryId];

        const title = document.createElement('h2');
        title.textContent = `Nové aktivum: ${category.name}`;
        title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
        dom.assetDetailContainer.appendChild(title);

        const form = document.createElement('form');
        form.id = `form-new-asset-${categoryId}`;
        form.className = 'edit-form-grid';

        const formElements = document.createDocumentFragment();

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Název';
        nameLabel.htmlFor = 'input-new-asset-name';
        const nameInputContainer = document.createElement('div');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'input-new-asset-name';
        nameInput.className = 'form-input';
        nameInput.required = true;
        nameInputContainer.appendChild(nameInput);
        formElements.appendChild(nameLabel);
        formElements.appendChild(nameInputContainer);

        let detailOrder = state.defaultSupportAssetOrder || [];
        const path = utils.getPathForAsset(categoryId) || "";
        const isInfoSystem = categoryId === 'informacni-systemy' || path.includes('informacni-systemy');

        // Změna: Detekce databáze a sítě pro filtrování pole 'Vlastnik'
        const isDatabase = categoryId === 'databaze' || path.includes('podpurna/children/databaze');
        const isNetwork = categoryId === 'site' || path.includes('podpurna/children/site');
        
        if (isInfoSystem) {
            detailOrder = state.infoSystemDetailOrder || detailOrder;
        }

        // Změna: Filtrace pole 'Vlastnik' pro DB a Sítě
        if (isDatabase || isNetwork) {
            detailOrder = detailOrder.filter(k => k !== 'Vlastnik');
        }
        
        // Změna: Filtrace pole 'Spravce_zastupce' pro DB
        if (isDatabase) {
            detailOrder = detailOrder.filter(k => k !== 'Spravce_zastupce');
        }

        const detailsForForm = createDetailsForForm(categoryId, {}, detailOrder);
        
        renderEditFormFields(formElements, `new-asset-${categoryId}`, detailsForForm, detailOrder, { isNewAsset: true, categoryId: categoryId, isInfoSystem });
        
        form.appendChild(formElements);
        dom.assetDetailContainer.appendChild(form);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Uložit';
        saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Zrušit';
        cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
        cancelButton.onclick = (e) => {
            e.preventDefault();
            showCategoryContent(categoryId);
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        form.appendChild(buttonContainer);

        saveButton.onclick = async (e) => {
            e.preventDefault();
            if (nameInput.value.trim() === '') {
                alert('Název nesmí být prázdný.');
                return;
            }
            showLoader();
            try {
                const success = await saveNewSupportAsset(categoryId);
                if (success) {
                    const reloaded = await reloadDataAndRebuildUI();
                    if (reloaded) {
                        showCategoryContent(categoryId);
                    }
                }
            } catch (error) {
                console.error("Error creating new asset:", error);
                alert("Nepodařilo se vytvořit nové aktivum.");
            } finally {
                hideLoader();
            }
        };
    } catch (err) {
        console.error("Error rendering new support asset form:", err);
        alert("Chyba při vykreslování formuláře.");
    }
}

function renderEditFormFields(formFragment, assetId, details, detailOrder, context = {}) {
    detailOrder.forEach(key => {
        
        // Změna: Skrýt pole "Zabezpečení zpracování - elektronické" a "Garant" ve formulářích pro agendy
        if ((context.isNewAgenda || context.isAgenda)) {
            if (key === "Zabezpečení zpracování - elektronické" || key === "Garant") {
                return;
            }
        }

        const detail = details[key];

        const label = document.createElement('label');
        label.textContent = key.replace(/_/g, ' ');
        const sanitizedKey = utils.sanitizeForId(key);
        label.htmlFor = `input-${assetId}-${sanitizedKey}`;

        const inputContainer = document.createElement('div');

        if (!detail) {
            const text = document.createElement('p');
            text.textContent = 'Tato položka nemá definovanou strukturu.';
            text.className = 'text-gray-500 pt-2';
            inputContainer.appendChild(text);
        
        // --- LOGIKA PRO KLASIFIKACI ---
        } else if (detail.type === 'classification') {
            if (context.isInfoSystem) {
                const p = document.createElement('p');
                p.className = 'py-2 text-gray-700 bg-gray-100 px-3 rounded text-sm';
                
                let calcValue = "VEŘEJNÉ"; // Výchozí pro nový asset
                if (!context.isNewAsset) {
                    const currentAsset = state.getAllAssets()[assetId];
                    calcValue = calculateMaxClassification(currentAsset);
                }
                
                p.innerHTML = `Aktuální hodnota: <strong>${calcValue}</strong><br><span class="text-xs text-gray-500">Hodnota se vypočítává automaticky na základě připojených agend. Nelze ji měnit ručně.</span>`;
                inputContainer.appendChild(p);
            } else {
                const select = document.createElement('select');
                select.id = `input-${assetId}-${sanitizedKey}`;
                select.className = 'form-input';
                
                // Možnosti pro klasifikaci
                const options = ["VEŘEJNÉ", "INTERNÍ", "CITLIVÉ", "CHRÁNĚNÉ"];
                
                options.forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option;
                    optionEl.textContent = option;
                    if (detail.value === option) {
                        optionEl.selected = true;
                    }
                    select.appendChild(optionEl);
                });
                inputContainer.appendChild(select);
            }

        } else if (key === "Lhůty pro výmaz" && detail.type === 'dictionary') {
            const subFormContainer = document.createElement('div');
            subFormContainer.className = 'space-y-2';
            for (const subKey in detail.value) {
                const subWrapper = document.createElement('div');
                const subLabel = document.createElement('label');
                subLabel.textContent = subKey.replace(/_/g, ' ');
                subLabel.className = 'block text-sm font-medium text-gray-500 capitalize';
                const subInput = document.createElement('input');
                subInput.type = 'text';
                subInput.id = `input-${assetId}-${sanitizedKey}-${utils.sanitizeForId(subKey)}`;
                subInput.value = detail.value[subKey] || '';
                subInput.className = 'form-input mt-1';
                subWrapper.appendChild(subLabel);
                subWrapper.appendChild(subInput);
                subFormContainer.appendChild(subWrapper);
            }
            inputContainer.appendChild(subFormContainer);
        } else if (key === "Způsob zpracování") {
            const methods = detail.value || [];
            methods.forEach((method, methodIndex) => {
                const methodWrapper = document.createElement('div');
                const methodId = `input-${assetId}-${sanitizedKey}-${methodIndex}`;

                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.className = 'flex items-center';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = methodId;
                checkbox.checked = method.checked;

                const checkboxLabel = document.createElement('label');
                checkboxLabel.htmlFor = methodId;
                checkboxLabel.textContent = method.label;
                checkboxLabel.className = "ml-2";

                checkboxWrapper.appendChild(checkbox);
                checkboxWrapper.appendChild(checkboxLabel);
                methodWrapper.appendChild(checkboxWrapper);

                if (method.label.includes("agendový informační systém")) {
                    const isSelectorContainer = document.createElement('div');
                    isSelectorContainer.className = 'ml-8 mt-2 p-2 border border-gray-200 rounded';

                    const linkedSystemsContainer = document.createElement('div');
                    linkedSystemsContainer.id = `linked-systems-${assetId}`;

                    const addSystemWrapper = document.createElement('div');
                    addSystemWrapper.className = 'mt-2 flex items-center space-x-2';

                    const select = document.createElement('select');
                    select.id = `is-select-${assetId}`;
                    select.className = 'form-input';

                    const addButton = document.createElement('button');
                    addButton.textContent = 'Přidat';
                    addButton.className = 'px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600';
                    addButton.type = 'button';

                    addSystemWrapper.appendChild(select);
                    addSystemWrapper.appendChild(addButton);

                    isSelectorContainer.appendChild(linkedSystemsContainer);
                    isSelectorContainer.appendChild(addSystemWrapper);
                    methodWrapper.appendChild(isSelectorContainer);
                } else if (method.details !== undefined) {
                    const detailsInput = document.createElement('input');
                    detailsInput.type = 'text';
                    detailsInput.id = `${methodId}-details`;
                    detailsInput.value = method.details;
                    detailsInput.className = 'form-input mt-1 ml-8';
                    methodWrapper.appendChild(detailsInput);
                }
                inputContainer.appendChild(methodWrapper);
            });
        } else if ((detail.type === 'checkbox-list' && detail.optionsKey) || detail.type === 'security') {
            const optionsKey = detail.optionsKey || (key.includes('elektronické') ? 'securityElectronic' : 'securityAnalog');
            const options = state.getSharedOptions()[optionsKey];
            const checked = detail.checked || detail.value || [];

            if (options && Array.isArray(checked)) {
                options.forEach((option, index) => {
                    const optionWrapper = document.createElement('div');
                    const checkboxId = `input-${assetId}-${sanitizedKey}-${index}`;
                    const wrapper = document.createElement('div');
                    wrapper.className = 'flex items-center';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = checkboxId;
                    checkbox.checked = checked[index];
                    const checkboxLabel = document.createElement('label');
                    checkboxLabel.htmlFor = checkboxId;
                    checkboxLabel.textContent = option;
                    checkboxLabel.className = "ml-2";
                    wrapper.appendChild(checkbox);
                    wrapper.appendChild(checkboxLabel);
                    optionWrapper.appendChild(wrapper);

                    if (option.toLowerCase().includes('jiné')) {
                        const detailsInput = document.createElement('input');
                        detailsInput.type = 'text';
                        detailsInput.id = `${checkboxId}-details`;
                        detailsInput.value = (detail.details && detail.details[index]) || (checkbox.checked ? 'neuvedeno' : '');
                        detailsInput.className = `form-input mt-1 ml-8 ${checkbox.checked ? '' : 'hidden'}`;
                        checkbox.onchange = () => {
                            detailsInput.classList.toggle('hidden', !checkbox.checked);
                            if (checkbox.checked && !detailsInput.value) {
                                detailsInput.value = 'neuvedeno';
                            }
                        };
                        optionWrapper.appendChild(detailsInput);
                    }
                    inputContainer.appendChild(optionWrapper);
                });
            }
        } else if (detail.type === 'lawfulness') {
            const select = document.createElement('select');
            select.id = `input-${assetId}-${sanitizedKey}`;
            select.className = 'form-input';
            state.getSharedOptions().lawfulness.forEach(option => {
                const optionEl = document.createElement('option');
                const value = option.split(')')[0];
                optionEl.value = value;
                optionEl.textContent = option;
                if (detail.value === value) {
                    optionEl.selected = true;
                }
                select.appendChild(optionEl);
            });
            inputContainer.appendChild(select);
        } else if (LINK_FIELDS.includes(key) || LINK_FIELDS.includes(key.replace(/_/g, ' ')) || detail.linksTo !== undefined) {
            if (detail.linksTo === undefined) {
                detail.linksTo = [];
            }
            renderLinkSelector(inputContainer, assetId, key, detail, context);
        } else if (detail.value !== undefined && typeof detail.value === 'string') {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `input-${assetId}-${sanitizedKey}`;
            input.value = detail.value;
            input.className = 'form-input';
            inputContainer.appendChild(input);
        } else {
            const text = document.createElement('p');
            text.textContent = 'Tuto položku nelze upravovat.';
            text.className = 'text-gray-500 pt-2';
            inputContainer.appendChild(text);
        }
        formFragment.appendChild(label);
        formFragment.appendChild(inputContainer);
    });
}

function renderLinkSelector(container, assetId, key, detail, context = {}) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId] || {};

    let assetPath;
    if (context.isNewAgenda) {
        assetPath = `agendy/children/${context.odborId}/children/${assetId}`;
    } else if (context.isNewAsset) {
        if (context.categoryId === 'informacni-systemy') {
             assetPath = 'primarni/children/informacni-systemy/children/new-asset';
        } else {
             const parentPath = utils.getPathForAsset(context.categoryId);
             assetPath = `${parentPath}/children/new-asset`;
        }
    } else if (context.isNewService) {
        assetPath = 'primarni/children/sluzby/children/new-service';
    } else {
        assetPath = utils.getPathForAsset(assetId);
    }
    
    const selectedItemsContainer = document.createElement('div');
    selectedItemsContainer.id = `selected-items-${assetId}-${utils.sanitizeForId(key)}`;
    selectedItemsContainer.className = 'flex flex-wrap items-center mb-2';

    const currentLinks = Array.isArray(detail.linksTo) ? detail.linksTo : [];

    const updateDropdown = (selectEl, currentSelection) => {
        let assetCategoryPath;
        
        if (assetPath.startsWith('agendy')) {
             assetCategoryPath = 'agendy';
        } else {
             assetCategoryPath = Object.keys(state.reciprocalMap).find(p => assetPath.startsWith(p));
        }

        if (!assetCategoryPath) {
             console.warn(`No reciprocalMap config found for asset path: ${assetPath}`);
             selectEl.innerHTML = '<option value="">Chyba konfigurace</option>';
             return;
        }

        const linkConfig = state.reciprocalMap[assetCategoryPath]?.[key.replace(/ /g, '_')];
        if (!linkConfig) {
             console.warn(`No linkConfig found for key ${key.replace(/ /g, '_')} in path ${assetCategoryPath}`);
             selectEl.innerHTML = '<option value="">Chyba konfigurace</option>';
             return;
        }

        const targetCategory = utils.getObjectByPath(state.getAssetData(), linkConfig.targetCategoryPath);
        selectEl.innerHTML = '<option value="">Vyberte položku...</option>';

        const populateOptions = (category, prefix = '') => {
            if (!category || !category.children) return;
            for (const [id, item] of Object.entries(category.children)) {
                if (item.children) {
                    populateOptions(item, `${prefix}${item.name} / `);
                } else if (!currentSelection.includes(id)) {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = `${prefix}${item.name}`;
                    selectEl.appendChild(option);
                }
            }
        };
        populateOptions(targetCategory);
    };

    const addSelectedItem = (id, name) => {
        const badge = document.createElement('span');
        badge.className = 'selected-item-badge';
        badge.dataset.id = id;
        badge.textContent = name;

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.type = 'button';
        removeBtn.onclick = () => {
            badge.remove();
            const currentSelection = Array.from(selectedItemsContainer.children).map(b => b.dataset.id);
            updateDropdown(select, currentSelection);
        };
        badge.appendChild(removeBtn);
        selectedItemsContainer.appendChild(badge);
    };

    currentLinks.forEach(linkId => {
        const linkedAsset = allAssets[linkId];
        const displayName = linkedAsset && linkedAsset.name ? linkedAsset.name : linkId; 
        addSelectedItem(linkId, displayName);
    });

    const addWrapper = document.createElement('div');
    addWrapper.className = 'flex items-center space-x-2';
    const select = document.createElement('select');
    select.className = 'form-input';

    const addButton = document.createElement('button');
    addButton.textContent = 'Přidat';
    addButton.type = 'button';
    addButton.className = 'px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600';
    addButton.onclick = () => {
        const selectedId = select.value;
        if (!selectedId) return;
        addSelectedItem(selectedId, allAssets[selectedId].name);
        const currentSelection = Array.from(selectedItemsContainer.children).map(b => b.dataset.id);
        updateDropdown(select, currentSelection);
    };

    updateDropdown(select, currentLinks);
    addWrapper.appendChild(select);
    addWrapper.appendChild(addButton);
    container.appendChild(selectedItemsContainer);
    container.appendChild(addWrapper);
}


// --- Form Submission Handlers ---

async function saveNewAgenda(odborId) {
    const form = document.getElementById(`form-new-agenda-${odborId}`);
    const newNameInput = form.querySelector('#input-new-agenda-name');
    const newName = newNameInput.value.trim();

    if (!newName) {
        alert('Název agendy nesmí být prázdný.');
        return false;
    }

    const newAgendaId = `${odborId}-${utils.sanitizeForId(newName.toLowerCase())}-${Date.now()}`;
    const newAgendaData = { name: newName, details: {} };

    const detailsForForm = createDetailsForForm(odborId, {}, state.detailOrder);

    for (const key in detailsForForm) {
        newAgendaData.details[key] = getDetailDataFromForm('new-agenda', key, detailsForForm[key]);
    }

    // Gather links for reciprocal updates
    const serviceLinks = newAgendaData.details['Regulované služby']?.linksTo || [];
    const aisMethod = newAgendaData.details['Způsob zpracování']?.value.find(m => m.label.includes("agendový informační systém"));
    const infoSystemLinks = aisMethod?.linksTo || [];

    const payload = {
        odborId,
        newAgendaId,
        newAgendaData,
        serviceLinks,
        infoSystemLinks
    };

    return await api.createNewAgenda(payload);
}

async function saveAgendaChanges(assetId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    const form = document.getElementById(`form-${assetId}`);
    const changedKeys = [];

    const parentId = utils.findParentId(assetId);
    const detailsForForm = createDetailsForForm(parentId, asset.details, state.detailOrder);
    const updatedDetails = {};

    const newNameInput = form.querySelector(`#input-${assetId}-name`);
    const newName = newNameInput.value.trim();
    if (newName !== asset.name) {
        changedKeys.push('name');
    }

    for (const key of state.detailOrder) {
        const originalDetail = asset.details ? asset.details[key] : undefined;
        const newDetailValue = getDetailDataFromForm(assetId, key, detailsForForm[key]);

        if (JSON.stringify(originalDetail) !== JSON.stringify(newDetailValue)) {
            updatedDetails[key] = newDetailValue;
            if (!changedKeys.includes(key)) changedKeys.push(key);
        } else if (originalDetail !== undefined) {
             updatedDetails[key] = originalDetail;
        }
    }

    if (Object.keys(updatedDetails).length > 0 && (changedKeys.length > 0 || JSON.stringify(asset.details) !== JSON.stringify(updatedDetails))) {
        const agendaPath = `agendy/children/${parentId}/children/${assetId}`;

        const originalAisMethod = asset.details?.["Způsob zpracování"]?.value.find(m => m.label.includes("agendový"));
        const updatedAisMethod = updatedDetails["Způsob zpracování"]?.value.find(m => m.label.includes("agendový"));
        const originalLinks = originalAisMethod?.linksTo || [];
        const newLinks = updatedAisMethod?.linksTo || [];

        const linksToAdd = newLinks.filter(id => !originalLinks.includes(id));
        const linksToRemove = originalLinks.filter(id => !newLinks.includes(id));

        const originalServiceLinks = asset.details?.['Regulované služby']?.linksTo || [];
        const newServiceLinks = updatedDetails['Regulované služby']?.linksTo || [];
        const serviceLinksToAdd = newServiceLinks.filter(id => !originalServiceLinks.includes(id));
        const serviceLinksToRemove = originalServiceLinks.filter(id => !newServiceLinks.includes(id));

        const payload = {
            agendaPath,
            newName: (newName !== asset.name ? newName : null),
            updatedAgendaDetails: updatedDetails,
            linksToAdd,
            linksToRemove,
            serviceLinks: {
                toAdd: serviceLinksToAdd,
                toRemove: serviceLinksToRemove
            },
            agendaId: assetId
        };
        const success = await api.updateAgenda(payload);
        return { changedKeys, success };
    }
    return { changedKeys: [], success: true };
}

async function saveSupportAssetChanges(assetId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    const form = document.getElementById(`form-${assetId}`);

    const newName = form.querySelector(`#input-${assetId}-name`).value.trim();

    const parentId = utils.findParentId(assetId);
    const isService = asset.type === 'jednotliva-sluzba';
    const isInfoSystem = utils.getPathForAsset(assetId).startsWith('primarni/children/informacni-systemy');

    let order = state.defaultSupportAssetOrder.filter(k => (asset.details && asset.details[k] !== undefined));
    if (isService) order = state.serviceDetailOrder;
    if (isInfoSystem) order = state.infoSystemDetailOrder;

    const detailsForForm = createDetailsForForm(parentId, asset.details, order);
    const updatedDetails = {};
    const initialDetails = asset.details || {};

    for (const key of order) {
         updatedDetails[key] = getDetailDataFromForm(assetId, key, detailsForForm[key]);
    }

    const hasNameChanged = newName !== asset.name;
    const haveDetailsChanged = JSON.stringify(initialDetails) !== JSON.stringify(updatedDetails);

    if (!hasNameChanged && !haveDetailsChanged) {
        return true; // No changes, operation is considered successful.
    }

    const reciprocalLinks = { toAdd: [], toRemove: [], agendasToAdd: [], agendasToRemove: [], sourceId: assetId };
    const assetPath = utils.getPathForAsset(assetId);

    for (const key in updatedDetails) {
        const newDetail = updatedDetails[key];
        if (newDetail.linksTo !== undefined) {
            const originalLinks = (initialDetails[key] && Array.isArray(initialDetails[key].linksTo)) ? initialDetails[key].linksTo : [];
            const newLinks = newDetail.linksTo;

            if (JSON.stringify(newLinks.sort()) !== JSON.stringify(originalLinks.sort())) {
                let assetCategoryPath = Object.keys(state.reciprocalMap).find(p => assetPath.startsWith(p));
                 if (isService) assetCategoryPath = 'primarni/children/sluzby';

                if (assetCategoryPath) {
                    const linkConfig = state.reciprocalMap[assetCategoryPath]?.[key.replace(/ /g, '_')];
                    if (linkConfig) {
                        const toAdd = newLinks.filter(id => !originalLinks.includes(id));
                        const toRemove = originalLinks.filter(id => !newLinks.includes(id));

                        if (linkConfig.reciprocalField === 'Regulované služby') { // Vazba Služba -> Agenda
                            reciprocalLinks.agendasToAdd.push(...toAdd);
                            reciprocalLinks.agendasToRemove.push(...toRemove);
                        } else { // Ostatní vazby
                            const createReciprocalPath = (targetId) => {
                                const targetAsset = allAssets[targetId];
                                if (targetAsset && targetAsset.type === 'jednotliva-sluzba') {
                                    const serviceParentId = utils.findParentId(targetId); 
                                    const serviceGrandparentId = utils.findParentId(serviceParentId);
                                    return `${serviceGrandparentId}/children/${serviceParentId}/children/${targetId}/details/${linkConfig.reciprocalField.replace(/_/g, ' ')}/linksTo`;
                                } else {
                                    // OPRAVA: Odstraněno automatické nahrazování podtržítek za mezery.
                                    // Klíč v `reciprocalField` musí být v `state.js` definován přesně.
                                    return `${linkConfig.targetCategoryPath}/children/${targetId}/details/${linkConfig.reciprocalField}/linksTo`;
                                }
                            };

                            toAdd.forEach(targetId => {
                                reciprocalLinks.toAdd.push({
                                    targetPath: createReciprocalPath(targetId),
                                    sourceId: assetId
                                });
                            });
                            toRemove.forEach(targetId => {
                                reciprocalLinks.toRemove.push({
                                    targetPath: createReciprocalPath(targetId),
                                    sourceId: assetId
                                });
                            });
                        }
                    }
                }
            }
        }
    }

    const payload = {
        assetPath,
        newName: hasNameChanged ? newName : null,
        updatedDetails,
        reciprocalLinks
    };

    return await api.updateSupportAsset(payload);
}

async function saveNewSupportAsset(categoryId) {
    const form = document.getElementById(`form-new-asset-${categoryId}`);
    const newNameInput = form.querySelector('#input-new-asset-name');
    const newName = newNameInput.value.trim();

    if (!newName) {
        alert('Název aktiva nesmí být prázdný.');
        return false;
    }

    const newAssetId = `${categoryId}-${utils.sanitizeForId(newName.toLowerCase())}-${Date.now()}`;
    const newAssetPath = `${utils.getPathForAsset(categoryId)}/children/${newAssetId}`;
    const newAssetData = { name: newName, details: {} };
    // reciprocalLinks now has an optional 'aisToAdd' field for linking IS to Agenda
    const reciprocalLinks = { toAdd: [], toRemove: [], aisToAdd: [] };

    // Determine correct order based on category
    let detailOrder = state.defaultSupportAssetOrder;
    const path = utils.getPathForAsset(categoryId);
    if (categoryId === 'informacni-systemy' || path.includes('informacni-systemy')) {
        detailOrder = state.infoSystemDetailOrder;
    }

    // Create a template structure for form reading
    const detailsForForm = createDetailsForForm(categoryId, {}, detailOrder);

    for (const key of detailOrder) {
        // Use the template to determine structure type
        const detailTemplate = detailsForForm[key];
        const newDetail = getDetailDataFromForm(`new-asset-${categoryId}`, key, detailTemplate);

        if (newDetail.linksTo) {
            const newLinks = newDetail.linksTo;
            const assetCategoryPath = Object.keys(state.reciprocalMap).find(p => newAssetPath.includes(p));
            
            if (assetCategoryPath) {
                 const linkConfig = state.reciprocalMap[assetCategoryPath]?.[key.replace(/ /g, '_')];
                 if (linkConfig) {
                    // Check if we are linking from Information System to Agenda
                    if (categoryId === 'informacni-systemy' && key === 'Agendy') {
                         newLinks.forEach(targetId => {
                             reciprocalLinks.aisToAdd.push(targetId);
                         });
                    } else {
                        // Standard link handling
                        newLinks.forEach(targetId => {
                            reciprocalLinks.toAdd.push({
                                // OPRAVA: Odstraněno automatické nahrazování podtržítek za mezery.
                                targetPath: `${linkConfig.targetCategoryPath}/children/${targetId}/details/${linkConfig.reciprocalField}/linksTo`,
                                sourceId: newAssetId
                            });
                        });
                    }
                }
            }
        }
        newAssetData.details[key] = newDetail;
    }

    const payload = { assetPath: newAssetPath, newAssetData, reciprocalLinks };
    return await api.createNewSupportAsset(payload);
}


/**
 * Helper to get data from a form field based on its type.
 */
function getDetailDataFromForm(formIdPrefix, key, detailTemplate) {
    const form = document.querySelector(`form[id^="form-${formIdPrefix}"]`);
    if (!form || !detailTemplate) return detailTemplate;

    const sanitizedKey = utils.sanitizeForId(key);
    const newDetail = JSON.parse(JSON.stringify(detailTemplate));

    if (key === "Lhůty pro výmaz" && newDetail.type === 'dictionary') {
        for (const subKey in newDetail.value) {
            const input = form.querySelector(`#input-${formIdPrefix}-${sanitizedKey}-${utils.sanitizeForId(subKey)}`);
            newDetail.value[subKey] = input ? input.value : '';
        }
    } else if (key === "Způsob zpracování") {
        newDetail.value.forEach((method, methodIndex) => {
            const checkbox = form.querySelector(`#input-${formIdPrefix}-${sanitizedKey}-${methodIndex}`);
            method.checked = checkbox ? checkbox.checked : false;
            if (method.checked) {
                if (method.label.includes("agendový informační systém")) {
                    const linkedContainer = form.querySelector(`#linked-systems-${formIdPrefix}`);
                    method.linksTo = linkedContainer ? Array.from(linkedContainer.children).map(div => div.dataset.systemId) : [];
                } else if (method.details !== undefined) {
                    const detailsInput = form.querySelector(`#input-${formIdPrefix}-${sanitizedKey}-${methodIndex}-details`);
                    method.details = detailsInput ? detailsInput.value : '';
                }
            } else {
                if (method.details !== undefined) method.details = '';
                if (method.linksTo !== undefined) method.linksTo = [];
            }
        });
    } else if ((newDetail.type === 'checkbox-list' && newDetail.optionsKey) || newDetail.type === 'security') {
        const optionsKey = newDetail.optionsKey || (key.includes('elektronické') ? 'securityElectronic' : 'securityAnalog');
        const checkedArray = [];
        const detailsObject = {};
        state.getSharedOptions()[optionsKey].forEach((option, index) => {
            const checkboxId = `input-${formIdPrefix}-${sanitizedKey}-${index}`;
            const checkbox = form.querySelector(`#${checkboxId}`);
            const isChecked = checkbox ? checkbox.checked : false;
            checkedArray.push(isChecked);

            if (option.toLowerCase().includes('jiné') && isChecked) {
                const detailsInput = form.querySelector(`#${checkboxId}-details`);
                detailsObject[index] = detailsInput ? detailsInput.value : 'neuvedeno';
            }
        });
        if(newDetail.checked) newDetail.checked = checkedArray;
        else newDetail.value = checkedArray;
        newDetail.details = detailsObject;

    } else if (newDetail.type === 'lawfulness') {
        const select = form.querySelector(`#input-${formIdPrefix}-${sanitizedKey}`);
        newDetail.value = select ? select.value : '';
    
    // --- NOVÝ KÓD PRO KLASIFIKACI ---
    } else if (newDetail.type === 'classification') {
        const select = form.querySelector(`#input-${formIdPrefix}-${sanitizedKey}`);
        newDetail.value = select ? select.value : '';
    // --- KONEC NOVÉHO KÓDU ---

    } else if (newDetail.linksTo !== undefined) {
        const linkedContainer = form.querySelector(`#selected-items-${formIdPrefix}-${sanitizedKey}`);
        newDetail.linksTo = linkedContainer ? Array.from(linkedContainer.children).map(div => div.dataset.id) : [];
    } else if (typeof newDetail.value === 'string' || newDetail.value === undefined) {
        const input = form.querySelector(`#input-${formIdPrefix}-${sanitizedKey}`);
        if(input) newDetail.value = input.value;
    }
    return newDetail;
}


async function renderUsersAdminPage() {
// Skryje uvítací zprávu a zobrazí hlavní kontejner
dom.welcomeMessage.classList.add('hidden');
dom.assetDetailContainer.classList.remove('hidden');

// Odebere aktivní třídu ze všech položek menu a přidá ji tlačítku "Uživatelé"
document.querySelectorAll('.sidebar-item.active, #nav-btn-users.active, #nav-btn-services-report.active').forEach(el => el.classList.remove('active'));
document.getElementById('nav-btn-users')?.classList.add('active');


  const container = dom.assetDetailContainer;
  container.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Správa uživatelů';
  title.className = 'text-3xl font-bold mb-4';
  container.appendChild(title);

  // Panel akcí (přidání uživatele)
  const actions = document.createElement('div');
  actions.className = 'mb-4';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'Přidat uživatele';
  addBtn.className = 'px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700';
  addBtn.onclick = async () => {
    const email = prompt('E-mail (nebo ponechte prázdné a zadejte UID v dalším kroku):', '');
    const uid = email ? '' : (prompt('UID:', '') || '').trim();
    const role = (prompt('Role (administrator/garant/informatik/zamestnanec/user):', 'user') || '').trim();
    const odbor = (prompt('Odbor (volitelné):', '') || '').trim();
    if (!email && !uid) return alert('Zadejte alespoň e-mail nebo UID.');
    showLoader();
    try {
      await api.upsertUser({ uid: uid || undefined, email: email || undefined, role, odbor: odbor || undefined });
      await refresh();
    } catch (e) {
      alert(e.message);
    } finally {
        hideLoader();
    }
  };
  actions.appendChild(addBtn);
  container.appendChild(actions);

  // Tabulka
  const table = document.createElement('table');
  table.className = 'w-full border border-gray-200 rounded overflow-hidden';
  const thead = document.createElement('thead');
  thead.className = 'bg-gray-50';
  const headRow = document.createElement('tr');
  ['UID', 'Email', 'Role', 'Odbor', 'Akce'].forEach(h => {
    const th = document.createElement('th');
    th.className = 'text-left px-3 py-2';
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  container.appendChild(table);

  async function refresh() {
    tbody.innerHTML = '';
    let rowLoading = document.createElement('tr');
    let tdLoading = document.createElement('td');
    tdLoading.colSpan = 5; tdLoading.className = 'px-3 py-2';
    tdLoading.textContent = 'Načítám…';
    rowLoading.appendChild(tdLoading);
    tbody.appendChild(rowLoading);

    try {
      const users = await api.fetchUsers();
      tbody.innerHTML = '';
      const entries = Object.entries(users);
      if (!entries.length) {
        const trEmpty = document.createElement('tr');
        const tdEmpty = document.createElement('td');
        tdEmpty.colSpan = 5; tdEmpty.className = 'px-3 py-2';
        tdEmpty.textContent = 'Žádní uživatelé.';
        trEmpty.appendChild(tdEmpty);
        tbody.appendChild(trEmpty);
        return;
      }

      entries.forEach(([uid, info]) => {
        const tr = document.createElement('tr');
        tr.className = 'border-t';

        const tdUid = document.createElement('td'); tdUid.className = 'px-3 py-2 font-mono text-sm'; tdUid.textContent = uid; tr.appendChild(tdUid);
        const tdEmail = document.createElement('td'); tdEmail.className = 'px-3 py-2'; tdEmail.textContent = info && info.email ? info.email : ''; tr.appendChild(tdEmail);
        const tdRole = document.createElement('td'); tdRole.className = 'px-3 py-2'; tdRole.textContent = info && info.role ? info.role : ''; tr.appendChild(tdRole);
        const tdOdbor = document.createElement('td'); tdOdbor.className = 'px-3 py-2'; tdOdbor.textContent = info && info.odbor ? info.odbor : ''; tr.appendChild(tdOdbor);

        const tdActions = document.createElement('td'); tdActions.className = 'px-3 py-2 space-x-2';
        const editBtn = document.createElement('button');
        editBtn.className = 'px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700';
        editBtn.textContent = 'Upravit';
        editBtn.onclick = async () => {
          const newEmail = prompt('Nový email:', (info && info.email) || '');
          const newRole = prompt('Nová role:', (info && info.role) || '');
          const newOdbor = prompt('Nový odbor:', (info && info.odbor) || '');
          if (newEmail !== null && newRole !== null) {
            showLoader();
            try {
              await api.upsertUser({ uid, email: newEmail, role: newRole, odbor: newOdbor });
              await refresh();
            } catch (e) {
              alert(e.message);
            } finally {
                hideLoader();
            }
          }
        };
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700';
        deleteBtn.textContent = 'Smazat';
        deleteBtn.onclick = async () => {
            showConfirmationModal(`Opravdu smazat tohoto uživatele z /users?`, async () => {
                 try {
                     await api.deleteUserByUid(uid);
                     await refresh();
                 } catch (e) {
                     alert(e.message);
                 }
            });
        };
        const changePassBtn = document.createElement('button');
        changePassBtn.className = 'px-2 py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600';
        changePassBtn.textContent = 'Změnit heslo';
        changePassBtn.onclick = async () => {
            const newPass = prompt(`Zadejte nové heslo pro uživatele ${info.email}:`);
            if (newPass) {
                if (newPass.length < 6) {
                    alert('Heslo musí mít alespoň 6 znaků.');
                    return;
                }
                showLoader();
                try {
                    await api.adminChangeUserPassword(uid, newPass);
                    alert('Heslo bylo úspěšně změněno.');
                } catch (e) {
                    console.error(e);
                    alert('Chyba při změně hesla: ' + (e.message || e));
                } finally {
                    hideLoader();
                }
            }
        };
        tdActions.appendChild(editBtn);
        tdActions.appendChild(changePassBtn);
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
      });
    } catch (e) {
      tbody.innerHTML = '';
      const trErr = document.createElement('tr');
      const tdErr = document.createElement('td');
      tdErr.colSpan = 5; tdErr.className = 'px-3 py-2 text-red-600';
      tdErr.textContent = e && e.message ? e.message : 'Chyba načítání';
      trErr.appendChild(tdErr);
      tbody.appendChild(trErr);
    }
  }

  await refresh();
}

/**
 * Renders the report of regulated services.
 */
export function renderServicesReport() {
    dom.welcomeMessage.classList.add('hidden');
    dom.assetDetailContainer.classList.remove('hidden');
    dom.assetDetailContainer.innerHTML = '';

    // Aktualizace aktivního tlačítka v menu
    document.querySelectorAll('.sidebar-item.active, #nav-btn-users.active, #nav-btn-services-report.active').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-btn-services-report')?.classList.add('active');

    const container = dom.assetDetailContainer;

    // Hlavička a tlačítko tisk
    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex justify-between items-center mb-6 pb-2 border-b border-gray-300';
    
    const title = document.createElement('h2');
    title.textContent = 'Přehled regulovaných služeb';
    title.className = 'text-3xl font-bold';
    
    const printBtn = document.createElement('button');
    printBtn.textContent = 'Tisk přehledu';
    printBtn.className = 'px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 print:hidden';
    printBtn.onclick = () => window.print();

    headerDiv.appendChild(title);
    headerDiv.appendChild(printBtn);
    container.appendChild(headerDiv);

    // Získání dat
    const assetData = state.getAssetData();
    const serviceCategories = assetData.primarni?.children?.sluzby?.children || {};
    
    // Seřazení kategorií
    const categoryKeys = Object.keys(serviceCategories).sort((a, b) => 
        serviceCategories[a].name.localeCompare(serviceCategories[b].name, 'cs')
    );

    if (categoryKeys.length === 0) {
        const noDataDiv = document.createElement('div');
        noDataDiv.textContent = 'Nebyly nalezeny žádné kategorie služeb.';
        noDataDiv.className = 'text-gray-500 italic';
        container.appendChild(noDataDiv);
        return;
    }

    // Generování tabulek pro kategorie
    categoryKeys.forEach(catKey => {
        const category = serviceCategories[catKey];
        const services = category.children || {};
        
        // Kontejner kategorie
        const categorySection = document.createElement('div');
        categorySection.className = 'mb-8 break-inside-avoid'; // break-inside-avoid pro tisk

        const catTitle = document.createElement('h3');
        catTitle.textContent = category.name;
        catTitle.className = 'text-xl font-bold text-blue-700 mb-3 border-l-4 border-blue-500 pl-3';
        categorySection.appendChild(catTitle);

        // Tabulka
        const table = document.createElement('table');
        table.className = 'w-full text-left border-collapse border border-gray-300 shadow-sm';
        
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-100';
        thead.innerHTML = `
            <tr>
                <th class="border border-gray-300 px-4 py-2 w-1/3">Název služby</th>
                <th class="border border-gray-300 px-4 py-2 w-1/3">Legislativa</th>
                <th class="border border-gray-300 px-4 py-2 w-1/3">Agendové informační systémy</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const serviceKeys = Object.keys(services).sort((a, b) => 
            services[a].name.localeCompare(services[b].name, 'cs')
        );

        if (serviceKeys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="border border-gray-300 px-4 py-2 text-center text-gray-500 italic">V této kategorii nejsou žádné služby.</td></tr>';
        } else {
            serviceKeys.forEach(serviceId => {
                const service = services[serviceId];
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';

                // Název
                const tdName = document.createElement('td');
                tdName.className = 'border border-gray-300 px-4 py-2 align-top font-medium';
                tdName.textContent = service.name;

                // Legislativa
                const tdLeg = document.createElement('td');
                tdLeg.className = 'border border-gray-300 px-4 py-2 align-top text-sm';
                tdLeg.textContent = service.details?.Legislativa?.value || '-';

                // Agendové IS
                const tdAis = document.createElement('td');
                tdAis.className = 'border border-gray-300 px-4 py-2 align-top text-sm';
                
                // Získání propojených AIS pomocí utility
                const connectedAIS = utils.getConnectedAISForService(serviceId);
                if (connectedAIS.length > 0) {
                    const ul = document.createElement('ul');
                    ul.className = 'list-disc list-inside';
                    connectedAIS.forEach(ais => {
                        const li = document.createElement('li');
                        li.textContent = ais.name;
                        ul.appendChild(li);
                    });
                    tdAis.appendChild(ul);
                } else {
                    tdAis.textContent = '-';
                }

                tr.appendChild(tdName);
                tr.appendChild(tdLeg);
                tr.appendChild(tdAis);
                tbody.appendChild(tr);
            });
        }

        table.appendChild(tbody);
        categorySection.appendChild(table);
        container.appendChild(categorySection);
    });
}

function renderNewServiceCategoryForm(parentId) {
    dom.assetDetailContainer.innerHTML = '';
    const allAssets = state.getAllAssets();
    const parentName = allAssets[parentId].name;

    const title = document.createElement('h2');
    title.textContent = `Nová kategorie pro: ${parentName}`;
    title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
    dom.assetDetailContainer.appendChild(title);

    const form = document.createElement('form');
    form.className = 'edit-form-grid';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Název kategorie';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-input';
    nameInput.required = true;

    form.appendChild(nameLabel);
    form.appendChild(nameInput);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.type = 'submit';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Zrušit';
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.onclick = (e) => {
        e.preventDefault();
        showCategoryContent(parentId);
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    form.appendChild(buttonContainer);

    form.onsubmit = async (e) => {
        e.preventDefault();
        const newCategoryName = nameInput.value.trim();
        if (!newCategoryName) {
            alert('Název kategorie nesmí být prázdný.');
            return;
        }
        showLoader();
        try {
            const success = await api.createNewServiceCategory({
                parentId,
                name: newCategoryName
            });
            if (success) {
                const reloaded = await reloadDataAndRebuildUI();
                 if (reloaded) {
                    const newCategoryId = utils.sanitizeForId(newCategoryName);
                    showCategoryContent(newCategoryId);
                }
            }
        } finally {
            hideLoader();
        }
    };

    dom.assetDetailContainer.appendChild(form);
}

function renderNewServiceForm(categoryId) {
    dom.assetDetailContainer.innerHTML = '';
    const allAssets = state.getAllAssets();
    const categoryName = allAssets[categoryId].name;

    const title = document.createElement('h2');
    title.textContent = `Nová služba v kategorii: ${categoryName}`;
    title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
    dom.assetDetailContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = `form-new-service-${categoryId}`;
    form.className = 'edit-form-grid';

    const formElements = document.createDocumentFragment();

    // Název služby
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Název služby';
    nameLabel.htmlFor = 'input-new-service-name';
    const nameInputContainer = document.createElement('div');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'input-new-service-name';
    nameInput.className = 'form-input';
    nameInput.required = true;
    nameInputContainer.appendChild(nameInput);
    formElements.appendChild(nameLabel);
    formElements.appendChild(nameInputContainer);

    const detailsForForm = createDetailsForForm(categoryId, {}, state.serviceDetailOrder);
    renderEditFormFields(formElements, `new-service-${categoryId}`, detailsForForm, state.serviceDetailOrder, { isNewService: true });
    
    form.appendChild(formElements);
    dom.assetDetailContainer.appendChild(form);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.type = 'button'; 

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Zrušit';
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.type = 'button';
    cancelButton.onclick = (e) => {
        e.preventDefault();
        showCategoryContent(categoryId);
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    form.appendChild(buttonContainer);

    saveButton.onclick = async (e) => {
        e.preventDefault();
        const newServiceName = nameInput.value.trim();
        if (!newServiceName) {
            alert('Název služby nesmí být prázdný.');
            return;
        }

        const legislativaInput = form.querySelector(`#input-new-service-${categoryId}-legislativa`);
        const agendaContainer = form.querySelector(`#selected-items-new-service-${categoryId}-agendy`);

        const newServiceData = {
            categoryId,
            name: newServiceName,
            legislativa: legislativaInput ? legislativaInput.value.trim() : '',
            agendy: agendaContainer ? Array.from(agendaContainer.children).map(badge => badge.dataset.id) : []
        };

        showLoader();
        try {
            const success = await api.createNewService(newServiceData);
            if (success) {
                await reloadDataAndRebuildUI();
                showCategoryContent(categoryId);
            }
        } finally {
            hideLoader();
        }
    };
}

// --- NOVÁ FUNKCE: Editace odboru (Název a Garant) ---
function renderEditDepartmentForm(odborId) {
    const allAssets = state.getAllAssets();
    const odbor = allAssets[odborId];
    dom.assetDetailContainer.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = `Úprava odboru: ${odbor.name}`;
    title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
    dom.assetDetailContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = `form-odbor-${odborId}`;
    form.className = 'edit-form-grid';

    // Název
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Název odboru';
    nameLabel.htmlFor = 'input-odbor-name';
    const nameInputContainer = document.createElement('div');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'input-odbor-name';
    nameInput.value = odbor.name;
    nameInput.className = 'form-input';
    nameInput.required = true;
    nameInputContainer.appendChild(nameInput);
    form.appendChild(nameLabel);
    form.appendChild(nameInputContainer);

    // Garant
    const garantLabel = document.createElement('label');
    garantLabel.textContent = 'Garant odboru';
    garantLabel.htmlFor = 'input-odbor-garant';
    const garantInputContainer = document.createElement('div');
    const garantInput = document.createElement('input');
    garantInput.type = 'text';
    garantInput.id = 'input-odbor-garant';
    // Načtení stávajícího garanta z details, pokud existuje
    garantInput.value = odbor.details && odbor.details.Garant ? odbor.details.Garant.value : '';
    garantInput.className = 'form-input';
    garantInputContainer.appendChild(garantInput);
    form.appendChild(garantLabel);
    form.appendChild(garantInputContainer);

    // Tlačítka
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    
    saveButton.onclick = async (e) => {
        e.preventDefault();
        showLoader();
        try {
            const newName = nameInput.value.trim();
            const newGarant = garantInput.value.trim();
            
            if (!newName) {
                alert("Název odboru je povinný.");
                hideLoader();
                return;
            }
            
            await saveDepartmentChanges(odborId, newName, newGarant);
            const reloaded = await reloadDataAndRebuildUI();
            if (reloaded) {
                showCategoryContent(odborId);
            }
        } catch (error) {
             console.error("Chyba při ukládání odboru:", error);
             alert("Uložení selhalo.");
        } finally {
            hideLoader();
        }
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Zrušit';
    cancelButton.className = 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300';
    cancelButton.onclick = (e) => {
        e.preventDefault();
        showCategoryContent(odborId);
    };

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(saveButton);
    form.appendChild(buttonContainer);

    dom.assetDetailContainer.appendChild(form);
}

// --- NOVÁ FUNKCE: Uložení změn odboru ---
async function saveDepartmentChanges(odborId, newName, newGarant) {
    const assetPath = `agendy/children/${odborId}`;
    
    // Použijeme existující updateSupportAsset API, které je dostatečně obecné (aktualizuje name a details)
    // Musíme připravit strukturu details
    const updatedDetails = {
        Garant: {
            value: newGarant
        }
    };

    const payload = {
        assetPath,
        newName,
        updatedDetails,
        reciprocalLinks: null // Odbory nemají reciproční vazby
    };

    return await api.updateSupportAsset(payload);
}