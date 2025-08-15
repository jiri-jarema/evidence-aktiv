import * as dom from './dom.js';
import * as state from './state.js';
import * as utils from './utils.js';
import * as api from './api.js';
import { reloadDataAndRebuildUI } from './auth.js';

/**
 * Displays a custom confirmation modal.
 * @param {string} message - The message to display in the modal.
 * @param {function} onConfirm - The callback function to execute on confirmation.
 */
function showConfirmationModal(message, onConfirm) {
    // Remove any existing modal
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
    confirmButton.onclick = () => {
        onConfirm();
        modalOverlay.remove();
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
 * @param {object} data - The hierarchical data for the navigation.
 * @param {HTMLElement} parentElement - The element to append the navigation to.
 * @param {number} [level=0] - The current recursion level.
 */
export function buildNav(data, parentElement, level = 0) {
  if (level === 0) {
    const userRole = state.getUserRole();
    if (userRole === 'administrator') {
      const adminSection = document.createElement('div');
      adminSection.className = 'mb-4';

      const btn = document.createElement('button');
      btn.id = 'nav-btn-users'; // Přidání ID
      btn.textContent = 'Uživatelé';
      btn.className = 'w-full text-left px-3 py-2 rounded hover:bg-gray-100 font-medium';
      btn.onclick = () => renderUsersAdminPage();

      adminSection.appendChild(btn);
      parentElement.appendChild(adminSection);

      const hr = document.createElement('hr');
      hr.className = 'my-4';
      parentElement.appendChild(hr);
    }
  }

    // Limit navigation depth in the sidebar to two levels.
    if (level >= 2) return; 
    const ul = document.createElement('ul');
    if (level > 0) ul.style.paddingLeft = `${(level - 1) * 16}px`;

    for (const key in data) {
        const item = data[key];
        const li = document.createElement('li');
        const itemDiv = document.createElement('div');
        itemDiv.textContent = item.name;
        itemDiv.dataset.id = key;
        itemDiv.className = level === 0 ? 'font-bold text-lg mt-4 cursor-default' : 'p-2 rounded-md sidebar-item';
        
        // Only items with children should be clickable categories
        if (level > 0 && item.children) {
            itemDiv.onclick = () => showCategoryContent(key);
        } else if (level > 0) {
            itemDiv.onclick = () => showAssetDetails(key, utils.findParentId(key));
        }


        li.appendChild(itemDiv);
        if (item.children) buildNav(item.children, li, level + 1);
        ul.appendChild(li);
    }
    parentElement.appendChild(ul);
}

/**
 * Displays the content for a selected category.
 * @param {string} categoryId - The ID of the category to display.
 */
export function showCategoryContent(categoryId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[categoryId];
    if (!asset || !asset.children) {
        showAssetDetails(categoryId, utils.findParentId(categoryId));
        return;
    }

    dom.welcomeMessage.classList.add('hidden');
    dom.assetDetailContainer.classList.remove('hidden');
    dom.assetDetailContainer.innerHTML = '';
    document.querySelectorAll('.sidebar-item.active, #nav-btn-users.active').forEach(el => el.classList.remove('active'));
    document.querySelector(`.sidebar-item[data-id="${categoryId}"]`)?.classList.add('active');

    const parentId = utils.findParentId(categoryId);

    // Add breadcrumbs for the category view
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

    if (parentId === 'agendy' && (userRole === 'administrator' || (userRole === 'garant' && userOdbor === categoryId))) {
        const addButton = document.createElement('button');
        addButton.textContent = 'Přidat novou agendu';
        addButton.className = 'px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600';
        addButton.onclick = () => renderNewAgendaForm(categoryId);
        titleContainer.appendChild(addButton);
    } else if ((parentId === 'primarni' || parentId === 'podpurna') && userRole === 'administrator') {
        if (categoryId !== 'sluzby') {
            const addButton = document.createElement('button');
            addButton.textContent = `Přidat do ${asset.name}`;
            addButton.className = 'px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600';
            addButton.onclick = () => renderNewSupportAssetForm(categoryId);
            titleContainer.appendChild(addButton);
        }
    }

    dom.assetDetailContainer.appendChild(titleContainer);

    const listContainer = document.createElement('div');
    listContainer.className = 'flex flex-col space-y-2'; 
    for (const childId in asset.children) {
        const childAsset = asset.children[childId];
        const listItem = document.createElement('div');
        listItem.className = 'bg-white p-4 rounded-md hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200';
        listItem.innerHTML = `<h3 class="font-semibold text-blue-600">${childAsset.name}</h3>`;

        if (childAsset.children) {
            listItem.onclick = () => showCategoryContent(childId);
        } else {
            listItem.onclick = () => showAssetDetails(childId, categoryId);
        }
        
        listContainer.appendChild(listItem);
    }
    dom.assetDetailContainer.appendChild(listContainer);
}

/**
 * Displays the details of a specific asset.
 * @param {string} assetId - The ID of the asset.
 * @param {string} parentId - The ID of the asset's parent.
 * @param {string[]} [changedKeys=[]] - Keys that have been changed to highlight them.
 */
export function showAssetDetails(assetId, parentId, changedKeys = []) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    if (!asset) return;

    dom.welcomeMessage.classList.add('hidden');
    dom.assetDetailContainer.classList.remove('hidden');
    dom.assetDetailContainer.innerHTML = '';
    document.querySelectorAll('.sidebar-item.active, #nav-btn-users.active').forEach(el => el.classList.remove('active'));
    
    const parentNavItem = document.querySelector(`.sidebar-item[data-id="${parentId}"]`);
    if(parentNavItem) parentNavItem.classList.add('active');


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

    const grandparentId = utils.findParentId(parentId);
    const isAgenda = grandparentId === 'agendy';
    const isService = asset.type === 'jednotliva-sluzba';
    const isSupportOrPrimary = !isAgenda && !isService;
    const userRole = state.getUserRole();
    const userOdbor = state.getUserOdbor();

    let canEdit = false;
    if (isAgenda && (userRole === 'administrator' || (userRole === 'garant' && userOdbor === parentId))) {
        canEdit = true;
    } else if ((isSupportOrPrimary || isService) && userRole === 'administrator') {
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

        if (isAgenda && userRole === 'administrator') {
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Smazat';
            deleteButton.className = 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700';
            deleteButton.onclick = () => {
                showConfirmationModal(`Opravdu si přejete smazat agendu "${asset.name}"? Tato akce je nevratná.`, async () => {
                    const success = await api.deleteAgenda(assetId);
                    if (success) {
                        const reloaded = await reloadDataAndRebuildUI();
                        if (reloaded) {
                            showCategoryContent(parentId); // Go back to parent category
                        }
                    } else {
                        // The api.js function already shows an alert on failure
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

    if (asset.type === 'jednotliva-sluzba') {
        const serviceFields = ['Legislativa', 'Agendový informační systém'];
        
        serviceFields.forEach(key => {
            const dt = document.createElement('dt');
            dt.textContent = key.replace(/_/g, ' ');
            const dd = document.createElement('dd');

            const detail = asset.details[key];

            if (detail) {
                if (detail.linksTo && detail.linksTo.length > 0) {
                    dd.appendChild(utils.createLinksFragment(detail.linksTo, showAssetDetails));
                } else {
                    dd.textContent = detail.value || '-';
                }
            } else {
                dd.textContent = '-';
            }
            detailsGrid.appendChild(dt);
            detailsGrid.appendChild(dd);
        });

        dom.assetDetailContainer.appendChild(detailsGrid);
        return;
    }


    if (asset.details && Object.keys(asset.details).length > 0) {
        const grandparentId = utils.findParentId(utils.findParentId(assetId));
        const isAgenda = grandparentId === 'agendy';
        const keysToRender = isAgenda ? state.detailOrder : Object.keys(asset.details).sort();

        keysToRender.forEach(key => {
            if (asset.details[key]) {
                const detail = asset.details[key];
                const dt = document.createElement('dt');
                dt.textContent = key.replace(/_/g, ' ');
                const dd = document.createElement('dd');

                if (changedKeys.includes(key)) {
                    dd.classList.add('changed-value');
                }

                if (detail.type === 'lawfulness') {
                    dd.textContent = sharedOptions.lawfulness.find(opt => opt.startsWith(detail.value)) || detail.value;
                } else if (detail.type === 'processing-methods') {
                    renderProcessingMethods(detail.value, dd);
                } else if (detail.type === 'checkbox-list' && detail.optionsKey) {
                    if (sharedOptions[detail.optionsKey] && detail.checked) {
                        renderCheckboxList(sharedOptions[detail.optionsKey], detail.checked, dd, detail.details);
                    }
                } else if (detail.type === 'security') {
                    renderCheckboxList(sharedOptions.securityElectronic, detail.value, dd, detail.details);
                } else if (detail.linksTo) {
                    dd.appendChild(utils.createLinksFragment(detail.linksTo, showAssetDetails));
                } else if (detail.type === 'dictionary' && typeof detail.value === 'object') {
                    const subList = document.createElement('ul');
                    subList.className = 'list-disc list-inside space-y-1';
                    for (const subKey in detail.value) {
                        if (detail.value.hasOwnProperty(subKey)) {
                            const listItem = document.createElement('li');
                            listItem.innerHTML = `<span class="font-medium capitalize">${subKey.replace(/_/g, ' ')}:</span> ${detail.value[subKey]}`;
                            subList.appendChild(listItem);
                        }
                    }
                    dd.appendChild(subList);
                } else {
                    dd.textContent = detail.value || '-';
                }
                detailsGrid.appendChild(dt);
                detailsGrid.appendChild(dd);
            }
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
        if (method.details || method.linksTo) {
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

    const emptyDetails = {};
    const firstAgendaKey = Object.keys(allAssets[odborId].children)[0];
    const sampleAgenda = allAssets[firstAgendaKey];
    for (const key in sampleAgenda.details) {
        emptyDetails[key] = JSON.parse(JSON.stringify(sampleAgenda.details[key]));
        if (typeof emptyDetails[key].value === 'string') emptyDetails[key].value = '';
        if (Array.isArray(emptyDetails[key].checked)) emptyDetails[key].checked.fill(false);
        if (Array.isArray(emptyDetails[key].value)) {
            emptyDetails[key].value.forEach(v => {
                v.checked = false;
                if (v.details) v.details = '';
                if (v.linksTo) v.linksTo = [];
            });
        }
        if (emptyDetails[key].type === 'dictionary') {
            for (const subKey in emptyDetails[key].value) {
                emptyDetails[key].value[subKey] = '';
            }
        }
    }

    const formElements = document.createDocumentFragment();
    renderEditFormFields(formElements, 'new-agenda', emptyDetails);
    form.appendChild(formElements);

    dom.assetDetailContainer.appendChild(form);
    
    const assetData = state.getAssetData();
    const zpDetail = emptyDetails["Způsob zpracování"];
    if (zpDetail) {
        const aisMethod = zpDetail.value.find(m => m.label.includes("agendový informační systém"));
        if (aisMethod) {
            const linkedSystemsContainer = document.getElementById(`linked-systems-new-agenda`);
            const selectEl = document.getElementById(`is-select-new-agenda`);
            const addButton = selectEl.nextElementSibling;

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
        const success = await api.createNewAgenda(odborId);
        if (success) {
            const reloaded = await reloadDataAndRebuildUI();
            if (reloaded) {
                showCategoryContent(odborId);
            }
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

    renderEditFormFields(formElements, assetId, asset.details);
    form.appendChild(formElements);

    dom.assetDetailContainer.appendChild(form);

    const zpDetail = asset.details["Způsob zpracování"];
    if (zpDetail) {
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
        const { changedKeys, success } = await saveAgendaChanges(assetId);
        if (success) {
            const reloaded = await reloadDataAndRebuildUI();
            if (reloaded) {
                showAssetDetails(assetId, utils.findParentId(assetId), changedKeys);
            }
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

    const detailsForForm = JSON.parse(JSON.stringify(asset.details || {}));
    if (asset.type === 'jednotliva-sluzba') {
        if (!detailsForForm['Agendový informační systém']) {
            detailsForForm['Agendový informační systém'] = { linksTo: [] };
        }
    }

    renderEditFormFields(formElements, assetId, detailsForForm);
    form.appendChild(formElements);
    dom.assetDetailContainer.appendChild(form);


    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.onclick = async (e) => {
        e.preventDefault();
        const success = await saveSupportAssetChanges(assetId);
        if (success) {
            const reloaded = await reloadDataAndRebuildUI();
            if (reloaded) {
                showAssetDetails(assetId, utils.findParentId(assetId));
            }
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

function renderEditFormFields(formFragment, assetId, details) {
    const detailKeys = details === state.detailOrder ? state.detailOrder : Object.keys(details);

    detailKeys.forEach(key => {
        if (details[key]) {
            const detail = details[key];
            const label = document.createElement('label');
            label.textContent = key.replace(/_/g, ' ');
            const sanitizedKey = utils.sanitizeForId(key);
            label.htmlFor = `input-${assetId}-${sanitizedKey}`;

            const inputContainer = document.createElement('div');

            if (key === "Lhůty pro výmaz" && detail.type === 'dictionary') {
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
                const methods = detail.value;
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
                const checked = detail.checked || detail.value;

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
            } else if (detail.linksTo !== undefined) {
                let categoryIdForLinks = null;
                if (assetId.startsWith('new-asset-')) {
                    categoryIdForLinks = assetId.replace('new-asset-', '');
                }
                renderLinkSelector(inputContainer, assetId, key, detail, categoryIdForLinks);
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
                inputContainer.appendChild(text);
            }
            formFragment.appendChild(label);
            formFragment.appendChild(inputContainer);
        }
    });
}

function renderNewSupportAssetForm(categoryId) {
    const allAssets = state.getAllAssets();
    const categoryAsset = allAssets[categoryId];
    dom.assetDetailContainer.innerHTML = '';

    if (!categoryAsset.children || Object.keys(categoryAsset.children).length === 0) {
        dom.assetDetailContainer.innerHTML = `<p class="text-red-500">Nelze přidat aktivum: kategorie "${categoryAsset.name}" neobsahuje žádná vzorová aktiva pro vytvoření formuláře.</p>`;
        return;
    }

    const title = document.createElement('h2');
    title.textContent = `Nové aktivum v kategorii: ${categoryAsset.name}`;
    title.className = 'text-3xl font-bold mb-6 pb-2 border-b border-gray-300';
    dom.assetDetailContainer.appendChild(title);

    const form = document.createElement('form');
    form.id = `form-new-asset-${categoryId}`;
    form.className = 'edit-form-grid';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Název aktiva';
    nameLabel.htmlFor = 'input-new-asset-name';
    const nameInputContainer = document.createElement('div');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'input-new-asset-name';
    nameInput.className = 'form-input';
    nameInput.required = true;
    nameInputContainer.appendChild(nameInput);
    form.appendChild(nameLabel);
    form.appendChild(nameInputContainer);

    const sampleAssetKey = Object.keys(categoryAsset.children)[0];
    const sampleAsset = categoryAsset.children[sampleAssetKey];
    const emptyDetails = {};
    for (const key in sampleAsset.details) {
        emptyDetails[key] = JSON.parse(JSON.stringify(sampleAsset.details[key]));
        if (typeof emptyDetails[key].value === 'string') {
            emptyDetails[key].value = '';
        }
        if (Array.isArray(emptyDetails[key].linksTo)) {
            emptyDetails[key].linksTo = [];
        }
    }

    const formElements = document.createDocumentFragment();
    renderEditFormFields(formElements, `new-asset-${categoryId}`, emptyDetails);
    form.appendChild(formElements);
    dom.assetDetailContainer.appendChild(form);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-6 flex justify-end space-x-4 col-span-2';
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Uložit nové aktivum';
    saveButton.className = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700';
    saveButton.onclick = async (e) => {
        e.preventDefault();
        if (nameInput.value.trim() === '') {
            alert('Název aktiva nesmí být prázdný.');
            return;
        }
        const success = await saveNewSupportAsset(categoryId);
        if (success) {
            const reloaded = await reloadDataAndRebuildUI();
            if (reloaded) {
                showCategoryContent(categoryId);
            }
        }
    };

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
}

function renderLinkSelector(container, assetId, key, detail, newAssetCategoryId = null) {
    const allAssets = state.getAllAssets();
    
    let assetPath;
    if (newAssetCategoryId) {
        const parentId = utils.findParentId(newAssetCategoryId);
        assetPath = `${parentId}/children/${newAssetCategoryId}`;
    } else {
        assetPath = utils.getPathForAsset(assetId);
    }

    const selectedItemsContainer = document.createElement('div');
    selectedItemsContainer.id = `selected-items-${assetId}-${utils.sanitizeForId(key)}`;
    selectedItemsContainer.className = 'flex flex-wrap items-center mb-2';

    const currentLinks = Array.isArray(detail.linksTo) ? detail.linksTo : (detail.linksTo ? [detail.linksTo] : []);

    const updateDropdown = (selectEl, currentSelection) => {
        const assetCategoryPath = Object.keys(state.reciprocalMap).find(p => assetPath.startsWith(p));
        if (!assetCategoryPath) {
             console.warn(`No reciprocalMap config found for asset path: ${assetPath}`);
             return;
        }
        const linkConfig = state.reciprocalMap[assetCategoryPath]?.[key.replace(/ /g, '_')];
        if (!linkConfig) {
             console.warn(`No linkConfig found for key ${key.replace(/ /g, '_')} in path ${assetCategoryPath}`);
             return;
        }
        
        const targetCategory = utils.getObjectByPath(state.getAssetData(), linkConfig.targetCategoryPath);
        selectEl.innerHTML = '<option value="">Vyberte položku...</option>';
        
        if (key === 'Regulovaná služba') {
            const servicesRoot = targetCategory.children; 
            for (const categoryKey in servicesRoot) {
                const serviceCategory = servicesRoot[categoryKey];
                if (serviceCategory.children) {
                    for (const serviceId in serviceCategory.children) {
                         if (!currentSelection.includes(serviceId)) {
                            const service = serviceCategory.children[serviceId];
                            const option = document.createElement('option');
                            option.value = serviceId;
                            option.textContent = `${serviceCategory.name} - ${service.name}`;
                            selectEl.appendChild(option);
                        }
                    }
                }
            }
        } else if (linkConfig.targetCategoryPath === 'agendy') {
            const agendyRoot = state.getAssetData().agendy.children;
            for (const odborKey in agendyRoot) {
                const odbor = agendyRoot[odborKey];
                if (odbor.children) {
                    for (const agendaId in odbor.children) {
                         if (!currentSelection.includes(agendaId)) {
                            const option = document.createElement('option');
                            option.value = agendaId;
                            option.textContent = `${odbor.name} - ${odbor.children[agendaId].name}`;
                            selectEl.appendChild(option);
                        }
                    }
                }
            }
        } else if (targetCategory && targetCategory.children) {
            for (const targetId in targetCategory.children) {
                if (!currentSelection.includes(targetId)) {
                    const option = document.createElement('option');
                    option.value = targetId;
                    option.textContent = targetCategory.children[targetId].name;
                    selectEl.appendChild(option);
                }
            }
        }
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
        if (allAssets[linkId]) {
            addSelectedItem(linkId, allAssets[linkId].name);
        }
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
        alert('Název agendy je povinný.');
        return false;
    }

    const newAgendaId = `${odborId}-${utils.sanitizeForId(newName.toLowerCase())}-${Date.now()}`;
    const newAgendaData = { name: newName, details: {} };
    const allAssets = state.getAllAssets();
    const firstAgendaKey = Object.keys(allAssets[odborId].children)[0];
    const sampleDetails = allAssets[firstAgendaKey].details;

    for (const key in sampleDetails) {
        newAgendaData.details[key] = getDetailDataFromForm('new-agenda', key, sampleDetails[key]);
    }
    
    return await api.createNewAgenda(odborId, newAgendaData);
}

async function saveAgendaChanges(assetId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    const form = document.getElementById(`form-${assetId}`);
    const changedKeys = [];
    const updatedDetails = JSON.parse(JSON.stringify(asset.details));

    const newNameInput = form.querySelector(`#input-${assetId}-name`);
    const newName = newNameInput.value.trim();
    if (newName !== asset.name) {
        changedKeys.push('name');
    }

    for (const key in updatedDetails) {
        const originalDetail = asset.details[key];
        const newDetailValue = getDetailDataFromForm(assetId, key, originalDetail);
        
        if (JSON.stringify(originalDetail) !== JSON.stringify(newDetailValue)) {
            updatedDetails[key] = newDetailValue;
            if (!changedKeys.includes(key)) changedKeys.push(key);
        }
    }

    if (changedKeys.length > 0) {
        const parentId = utils.findParentId(assetId);
        const agendaPath = `agendy/children/${parentId}/children/${assetId}`;

        const originalAisMethod = asset.details["Způsob zpracování"]?.value.find(m => m.label.includes("agendový"));
        const updatedAisMethod = updatedDetails["Způsob zpracování"]?.value.find(m => m.label.includes("agendový"));
        const originalLinks = originalAisMethod?.linksTo?.slice() || [];
        const newLinks = updatedAisMethod?.linksTo?.slice() || [];

        const linksToAdd = newLinks.filter(id => !originalLinks.includes(id));
        const linksToRemove = originalLinks.filter(id => !newLinks.includes(id));

        const payload = {
            agendaPath,
            newName: (newName !== asset.name ? newName : null),
            updatedAgendaDetails: updatedDetails,
            linksToAdd,
            linksToRemove,
            agendaId: assetId
        };
        const success = await api.updateAgenda(payload);
        return { changedKeys, success };
    }
    return { changedKeys: [], success: true }; // No changes, but operation is "successful"
}

async function saveSupportAssetChanges(assetId) {
    const allAssets = state.getAllAssets();
    const asset = allAssets[assetId];
    const form = document.getElementById(`form-${assetId}`);
    
    const newName = form.querySelector(`#input-${assetId}-name`).value.trim();
    const initialDetails = JSON.parse(JSON.stringify(asset.details || {}));
    const updatedDetails = {};

    const formKeys = new Set(Object.keys(initialDetails));
    if (asset.type === 'jednotliva-sluzba') {
        formKeys.add('Legislativa');
        formKeys.add('Agendový informační systém');
    }

    for (const key of formKeys) {
        const template = initialDetails[key] || (key === 'Agendový informační systém' ? { linksTo: [] } : { value: '' });
        updatedDetails[key] = getDetailDataFromForm(assetId, key, template);
    }

    const hasNameChanged = newName !== asset.name;
    const haveDetailsChanged = JSON.stringify(initialDetails) !== JSON.stringify(updatedDetails);

    if (!hasNameChanged && !haveDetailsChanged) {
        return true; // No changes, operation is considered successful.
    }

    const reciprocalLinks = { toAdd: [], toRemove: [] };
    const assetPath = utils.getPathForAsset(assetId);

    for (const key in updatedDetails) {
        const newDetail = updatedDetails[key];
        if (newDetail.linksTo !== undefined) {
            const originalLinks = (initialDetails[key] && Array.isArray(initialDetails[key].linksTo)) ? initialDetails[key].linksTo : [];
            const newLinks = newDetail.linksTo;

            if (JSON.stringify(newLinks.sort()) !== JSON.stringify(originalLinks.sort())) {
                const assetCategoryPath = Object.keys(state.reciprocalMap).find(p => assetPath.startsWith(p));
                if (assetCategoryPath) {
                    const linkConfig = state.reciprocalMap[assetCategoryPath]?.[key.replace(/ /g, '_')];
                    if (linkConfig) {
                        const toAdd = newLinks.filter(id => !originalLinks.includes(id));
                        const toRemove = originalLinks.filter(id => !newLinks.includes(id));

                        const createReciprocalPath = (targetId) => {
                            // For services, we need to build the full path dynamically
                            const serviceParentId = utils.findParentId(targetId); 
                            const serviceGrandparentId = utils.findParentId(serviceParentId);
                            const serviceGreatGrandparentId = utils.findParentId(serviceGrandparentId);
                            // Check if the path is for a service to avoid errors with other types
                            if (serviceGreatGrandparentId === 'primarni' && serviceGrandparentId === 'sluzby') {
                                return `${serviceGreatGrandparentId}/children/${serviceGrandparentId}/children/${serviceParentId}/children/${targetId}/details/${linkConfig.reciprocalField.replace(/_/g, ' ')}/linksTo`;
                            } else {
                                // Generic path for other types
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
    const allAssets = state.getAllAssets();
    const categoryAsset = allAssets[categoryId];
    const sampleAssetKey = Object.keys(categoryAsset.children)[0];
    const sampleAsset = categoryAsset.children[sampleAssetKey];

    const newAssetData = { name: newName, details: {} };
    const reciprocalLinks = { toAdd: [], toRemove: [] };
    const newAssetPath = `${utils.getPathForAsset(categoryId)}/children/${newAssetId}`;

    for (const key in sampleAsset.details) {
        const detail = sampleAsset.details[key];
        const newDetail = { ...detail };
        
        if (detail.linksTo) {
            const selectedItemsContainer = form.querySelector(`#selected-items-new-asset-${categoryId}-${utils.sanitizeForId(key)}`);
            const newLinks = Array.from(selectedItemsContainer.children).map(badge => badge.dataset.id);
            newDetail.linksTo = newLinks;

            const assetCategoryPath = Object.keys(state.reciprocalMap).find(p => newAssetPath.includes(p));
            const linkConfig = state.reciprocalMap[assetCategoryPath]?.[key.replace(/ /g, '_')];
            
            if (linkConfig) {
                newLinks.forEach(targetId => {
                    reciprocalLinks.toAdd.push({
                        targetPath: `${linkConfig.targetCategoryPath}/children/${targetId}/details/${linkConfig.reciprocalField}/linksTo`,
                        sourceId: newAssetId
                    });
                });
            }
        } else {
            const input = form.querySelector(`#input-new-asset-${categoryId}-${utils.sanitizeForId(key)}`);
            newDetail.value = input ? input.value : '';
        }
        newAssetData.details[key] = newDetail;
    }
    
    const payload = { assetPath: newAssetPath, newAssetData, reciprocalLinks };
    return await api.createNewSupportAsset(payload);
}


/**
 * Helper to get data from a form field based on its type.
 * @param {string} formIdPrefix - The prefix for the form element IDs.
 * @param {string} key - The detail key.
 * @param {object} detailTemplate - The template object for the detail.
 * @returns {object} - The updated detail object.
 */
function getDetailDataFromForm(formIdPrefix, key, detailTemplate) {
    const form = document.querySelector(`form[id^="form-${formIdPrefix}"]`);
    if (!form) return detailTemplate;

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
document.querySelectorAll('.sidebar-item.active, #nav-btn-users.active').forEach(el => el.classList.remove('active'));
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
    const role = (prompt('Role (administrator/garant/zamestnanec/user):', 'user') || '').trim();
    const odbor = (prompt('Odbor (volitelné):', '') || '').trim();
    if (!email && !uid) return alert('Zadejte alespoň e-mail nebo UID.');
    try {
      await api.upsertUser({ uid: uid || undefined, email: email || undefined, role, odbor: odbor || undefined });
      await refresh();
    } catch (e) {
      alert(e.message);
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
            try {
              await api.upsertUser({ uid, email: newEmail, role: newRole, odbor: newOdbor });
              await refresh();
            } catch (e) {
              alert(e.message);
            }
          }
        };
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700';
        deleteBtn.textContent = 'Smazat';
        deleteBtn.onclick = async () => {
            showConfirmationModal(`Opravdu smazat tohoto uživatele z /users?`, async () => {
                 try { await api.deleteUserByUid(uid); await refresh(); } catch (e) { alert(e.message); }
            });
        };
        tdActions.appendChild(editBtn);
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
