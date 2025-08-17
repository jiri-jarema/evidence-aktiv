import { state, setState } from './state.js';
import { getOptions } from './utils.js';

// Function to find an asset by its path (restored to its original location)
function findAssetByPath(data, path) {
    if (!path) return null;
    const pathParts = path.split('.children.');
    let currentAsset = data;
    for (const part of pathParts) {
        if (currentAsset && currentAsset[part]) {
            currentAsset = currentAsset[part];
        } else if (currentAsset && currentAsset.children && currentAsset.children[part]) {
            currentAsset = currentAsset.children[part];
        }
        else {
            return null;
        }
    }
    return currentAsset;
}

// Function to create the asset tree view
export function createTreeView(data, parentElement, path = '') {
    const ul = document.createElement('ul');
    if (path === '') {
        ul.classList.add('tree', 'tree-light'); // Add initial classes for the root
    }

    for (const key in data) {
        if (key === 'name' || key === 'details' || key === 'type') continue;

        const currentPath = path ? `${path}.children.${key}` : key;
        const asset = data[key];
        const li = document.createElement('li');
        li.classList.add('tree-item');

        const details = document.createElement('details');
        details.setAttribute('open', asset.isOpen || false);
        details.addEventListener('toggle', () => {
            const currentAsset = findAssetByPath(state.data, currentPath);
            if (currentAsset) {
                currentAsset.isOpen = details.open;
            }
        });

        const summary = document.createElement('summary');
        summary.textContent = asset.name;
        summary.classList.add('tree-item-summary');
        summary.dataset.path = currentPath;
        summary.addEventListener('click', (e) => {
            e.preventDefault();
            selectAsset(currentPath);
        });

        details.appendChild(summary);

        if (asset.children) {
            createTreeView(asset.children, details, currentPath);
        }

        li.appendChild(details);
        ul.appendChild(li);
    }
    parentElement.appendChild(ul);
}

// Function to handle asset selection
export function selectAsset(path) {
    if (state.selectedAssetPath === path) return;

    // Remove highlight from previously selected asset
    if (state.selectedAssetPath) {
        const oldSelected = document.querySelector(`[data-path="${state.selectedAssetPath}"]`);
        if (oldSelected) {
            oldSelected.classList.remove('selected');
        }
    }

    // Highlight the new selected asset
    const newSelected = document.querySelector(`[data-path="${path}"]`);
    if (newSelected) {
        newSelected.classList.add('selected');
    }

    setState({ selectedAssetPath: path, isEditing: false });
    const asset = findAssetByPath(state.data, path);
    if (asset) {
        renderAssetDetails(asset, path);
    }
}

// Function to render asset details
export function renderAssetDetails(asset, path) {
    const detailsContainer = document.getElementById('details-container');
    detailsContainer.innerHTML = ''; // Clear previous content

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.textContent = asset.name;
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'card-body';

    if (state.isEditing) {
        body.appendChild(createAssetForm(asset, path));
    } else {
        body.appendChild(createDetailView(asset, path));
    }

    card.appendChild(body);
    detailsContainer.appendChild(card);
}

// Function to create the detail view of an asset
function createDetailView(asset, path) {
    const container = document.createElement('div');
    if (!asset.details) return container;

    for (const key in asset.details) {
        const detail = asset.details[key];
        const detailGroup = document.createElement('div');
        detailGroup.className = 'detail-group';

        const label = document.createElement('strong');
        label.textContent = `${key}: `;
        detailGroup.appendChild(label);

        if (detail.type === 'checkbox-list' || detail.type === 'radio-list') {
            const options = getOptions(detail.optionsKey);
            const list = document.createElement('ul');
            list.className = 'detail-list';
            options.forEach((option, index) => {
                if (detail.checked[index]) {
                    const item = document.createElement('li');
                    item.textContent = option;
                    list.appendChild(item);
                }
            });
            detailGroup.appendChild(list);
        } else if (detail.type === 'dictionary') {
            const dl = document.createElement('dl');
            for (const term in detail.value) {
                const dt = document.createElement('dt');
                dt.textContent = term;
                const dd = document.createElement('dd');
                dd.textContent = detail.value[term];
                dl.appendChild(dt);
                dl.appendChild(dd);
            }
            detailGroup.appendChild(dl);
        } else if (detail.linksTo) {
            const list = document.createElement('ul');
            list.className = 'detail-list';
            detail.linksTo.forEach(linkId => {
                const linkedAsset = findAssetById(state.data, linkId);
                if (linkedAsset) {
                    const item = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = linkedAsset.asset.name;
                    link.onclick = (e) => {
                        e.preventDefault();
                        selectAsset(linkedAsset.path);
                        // Open tree to the selected asset
                        const pathParts = linkedAsset.path.split('.children.');
                        let currentPath = '';
                        pathParts.forEach((part, index) => {
                            currentPath = index === 0 ? part : `${currentPath}.children.${part}`;
                            const element = document.querySelector(`[data-path="${currentPath}"]`);
                            if (element) {
                                const details = element.closest('details');
                                if (details) {
                                    details.open = true;
                                }
                            }
                        });
                    };
                    item.appendChild(link);
                    list.appendChild(item);
                }
            });
            detailGroup.appendChild(list);
        } else {
            const value = document.createElement('span');
            value.textContent = detail.value;
            detailGroup.appendChild(value);
        }
        container.appendChild(detailGroup);
    }
    
    // --- NEW LOGIC FOR INDIRECT LINKS IN DETAIL VIEW ---

    // For 'jednotliva-sluzba', show IS linked via Agendas
    if (asset.type === 'jednotliva-sluzba') {
        const linkedAgendas = asset.details['Agendy']?.linksTo || [];
        const allIS = getAllAssetsByType(state.data, 'is');
        const indirectIS = new Map();

        allIS.forEach(isAsset => {
            const isAgendas = isAsset.asset.details['Agendy']?.linksTo || [];
            if (linkedAgendas.some(agendaId => isAgendas.includes(agendaId))) {
                indirectIS.set(isAsset.path.split('.').pop(), isAsset.asset);
            }
        });

        if (indirectIS.size > 0) {
            const detailGroup = document.createElement('div');
            detailGroup.className = 'detail-group';
            const label = document.createElement('strong');
            label.textContent = 'Agendový informační systém (odvozeno z agend): ';
            detailGroup.appendChild(label);
            
            const list = document.createElement('ul');
            list.className = 'detail-list';
            indirectIS.forEach((isAsset, id) => {
                const linkedInfo = findAssetById(state.data, id);
                if(linkedInfo) {
                    const item = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = linkedInfo.asset.name;
                    link.onclick = (e) => {
                        e.preventDefault();
                        selectAsset(linkedInfo.path);
                    };
                    item.appendChild(link);
                    list.appendChild(item);
                }
            });
            detailGroup.appendChild(list);
            container.appendChild(detailGroup);
        }
    }

    // For 'is', show services linked via Agendas
    if (asset.type === 'is') {
        const linkedAgendas = asset.details['Agendy']?.linksTo || [];
        const allServices = getAllAssetsByType(state.data, 'jednotliva-sluzba');
        const indirectServices = new Map();

        allServices.forEach(serviceAsset => {
            const serviceAgendas = serviceAsset.asset.details['Agendy']?.linksTo || [];
            if (linkedAgendas.some(agendaId => serviceAgendas.includes(agendaId))) {
                indirectServices.set(serviceAsset.path.split('.').pop(), serviceAsset.asset);
            }
        });

        if (indirectServices.size > 0) {
            const detailGroup = document.createElement('div');
            detailGroup.className = 'detail-group';
            const label = document.createElement('strong');
            label.textContent = 'Regulované služby (odvozeno z agend): ';
            detailGroup.appendChild(label);

            const list = document.createElement('ul');
            list.className = 'detail-list';
            indirectServices.forEach((serviceAsset, id) => {
                 const linkedInfo = findAssetById(state.data, id);
                if(linkedInfo) {
                    const item = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = linkedInfo.asset.name;
                    link.onclick = (e) => {
                        e.preventDefault();
                        selectAsset(linkedInfo.path);
                    };
                    item.appendChild(link);
                    list.appendChild(item);
                }
            });
            detailGroup.appendChild(list);
            container.appendChild(detailGroup);
        }
    }


    return container;
}

// Function to create the form for editing an asset
function createAssetForm(asset, path) {
    const form = document.createElement('form');
    form.id = 'asset-form';

    // Add name input
    const nameGroup = createFormGroup('Název', 'asset-name', 'text', asset.name);
    form.appendChild(nameGroup);

    if (asset.details) {
        for (const key in asset.details) {
            const detail = asset.details[key];
            let formGroup;

            // --- NEW LOGIC FOR INDIRECT LINKS IN FORMS ---
            // Skip direct linking for IS on Service form
            if (asset.type === 'jednotliva-sluzba' && key === 'Agendový informační systém') {
                const linkedAgendas = asset.details['Agendy']?.linksTo || [];
                const allIS = getAllAssetsByType(state.data, 'is');
                const indirectIS = new Map();

                allIS.forEach(isAsset => {
                    const isAgendas = isAsset.asset.details['Agendy']?.linksTo || [];
                    if (linkedAgendas.some(agendaId => isAgendas.includes(agendaId))) {
                        indirectIS.set(isAsset.path.split('.').pop(), isAsset.asset.name);
                    }
                });

                formGroup = createReadOnlyList('Agendový informační systém (odvozeno z agend)', indirectIS);

            } // Skip direct linking for Services on IS form
            else if (asset.type === 'is' && key === 'Regulované služby') {
                 const linkedAgendas = asset.details['Agendy']?.linksTo || [];
                 const allServices = getAllAssetsByType(state.data, 'jednotliva-sluzba');
                 const indirectServices = new Map();

                 allServices.forEach(serviceAsset => {
                     const serviceAgendas = serviceAsset.asset.details['Agendy']?.linksTo || [];
                     if (linkedAgendas.some(agendaId => serviceAgendas.includes(agendaId))) {
                        indirectServices.set(serviceAsset.path.split('.').pop(), serviceAsset.asset.name);
                     }
                 });
                 formGroup = createReadOnlyList('Regulované služby (odvozeno z agend)', indirectServices);
            }
            // --- END OF NEW LOGIC ---
            else if (detail.linksTo) {
                let optionsSourceType;
                switch (asset.type) {
                    case 'jednotliva-sluzba':
                        if (key === 'Agendy') optionsSourceType = 'agenda';
                        break;
                    case 'is':
                        if (key === 'Agendy') optionsSourceType = 'agenda';
                        break;
                    case 'agenda':
                         if (key === 'Informační systémy') optionsSourceType = 'is';
                         if (key === 'Regulované služby') optionsSourceType = 'jednotliva-sluzba';
                        break;
                }
                if (optionsSourceType) {
                    const allAssets = getAllAssetsByType(state.data, optionsSourceType);
                    const options = Object.fromEntries(
                        allAssets.map(a => [a.path.split('.').pop(), a.asset.name])
                    );
                    formGroup = createMultiSelect(key, options, detail.linksTo);
                }
            } else if (detail.type === 'checkbox-list' || detail.type === 'radio-list') {
                const options = getOptions(detail.optionsKey);
                formGroup = createCheckboxOrRadioList(key, options, detail.checked, detail.type);
            } else if (detail.type === 'dictionary') {
                formGroup = createDictionaryEditor(key, detail.value);
            } else {
                formGroup = createFormGroup(key, `detail-${key}`, 'text', detail.value);
            }

            if (formGroup) {
                form.appendChild(formGroup);
            }
        }
    }
    return form;
}

// Helper to create a simple form group
function createFormGroup(labelText, inputId, inputType, value) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = inputType;
    input.id = inputId;
    input.name = inputId;
    input.value = value;
    input.className = 'form-control';
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    return formGroup;
}

// Helper to create a multi-select dropdown
function createMultiSelect(labelText, options, selectedValues = []) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    const select = document.createElement('select');
    select.multiple = true;
    select.id = `detail-${labelText.replace(/\s+/g, '-')}`;
    select.name = select.id;
    select.className = 'form-control';

    for (const key in options) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = options[key];
        if (selectedValues.includes(key)) {
            option.selected = true;
        }
        select.appendChild(option);
    }

    formGroup.appendChild(label);
    formGroup.appendChild(select);
    return formGroup;
}

// Helper to create a read-only list for linked items
function createReadOnlyList(labelText, items) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    formGroup.appendChild(label);

    const listContainer = document.createElement('div');
    listContainer.className = 'read-only-list';

    if (items.size > 0) {
        const ul = document.createElement('ul');
        items.forEach((name, id) => {
            const li = document.createElement('li');
            li.textContent = name;
            ul.appendChild(li);
        });
        listContainer.appendChild(ul);
    } else {
        listContainer.textContent = 'Žádné propojené položky.';
    }
    
    formGroup.appendChild(listContainer);
    return formGroup;
}


// Helper to create checkbox or radio button lists
function createCheckboxOrRadioList(labelText, options, checkedItems, type) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const legend = document.createElement('legend');
    legend.textContent = labelText;
    formGroup.appendChild(legend);

    options.forEach((option, index) => {
        const itemGroup = document.createElement('div');
        itemGroup.className = 'form-check';
        const input = document.createElement('input');
        input.type = type === 'radio-list' ? 'radio' : 'checkbox';
        input.className = 'form-check-input';
        input.name = `detail-${labelText.replace(/\s+/g, '-')}`;
        input.id = `${input.name}-${index}`;
        input.checked = checkedItems[index] || false;
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.setAttribute('for', input.id);
        label.textContent = option;
        itemGroup.appendChild(input);
        itemGroup.appendChild(label);
        formGroup.appendChild(itemGroup);
    });

    return formGroup;
}

// Helper to create a dictionary editor
function createDictionaryEditor(labelText, dictionary) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group dictionary-editor';
    formGroup.dataset.key = labelText;
    const legend = document.createElement('legend');
    legend.textContent = labelText;
    formGroup.appendChild(legend);

    for (const key in dictionary) {
        const row = document.createElement('div');
        row.className = 'dictionary-row';
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.value = key;
        keyInput.className = 'form-control';
        keyInput.readOnly = true; // Keys are not editable
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.value = dictionary[key];
        valueInput.className = 'form-control';
        valueInput.dataset.key = key;
        row.appendChild(keyInput);
        row.appendChild(valueInput);
        formGroup.appendChild(row);
    }
    return formGroup;
}


// Function to collect form data
export function getFormData(form) {
    const formData = new FormData(form);
    const data = {
        name: formData.get('asset-name'),
        details: {}
    };

    const asset = findAssetByPath(state.data, state.selectedAssetPath);
    if (!asset.details) return data;

    for (const key in asset.details) {
        const detail = asset.details[key];
        const inputName = `detail-${key.replace(/\s+/g, '-')}`;

        if (detail.linksTo) {
             // Skip indirect links from form data collection
            if ((asset.type === 'jednotliva-sluzba' && key === 'Agendový informační systém') ||
                (asset.type === 'is' && key === 'Regulované služby')) {
                // Keep existing links if any, but don't update from form
                data.details[key] = { ...detail };
                // Ensure linksTo is not collected from the form
                delete data.details[key].linksTo; 
                // We actually want to preserve the other links, so we re-add them
                const select = form.querySelector(`#${inputName}`);
                if(select) {
                     data.details[key].linksTo = Array.from(select.selectedOptions).map(opt => opt.value);
                } else {
                    // If the field was not rendered (because it's now indirect), we must not send old values
                    // But we must handle the case for Agendas, which are still directly editable
                    if(detail.linksTo) {
                        data.details[key].linksTo = detail.linksTo;
                    }
                }
                continue; // Skip to next detail
            }

            const select = form.querySelector(`#${inputName}`);
            if (select) {
                data.details[key] = {
                    ...detail,
                    linksTo: Array.from(select.selectedOptions).map(opt => opt.value)
                };
            }
        } else if (detail.type === 'checkbox-list' || detail.type === 'radio-list') {
            const inputs = form.querySelectorAll(`input[name="${inputName}"]`);
            data.details[key] = {
                ...detail,
                checked: Array.from(inputs).map(input => input.checked)
            };
        } else if (detail.type === 'dictionary') {
            const editor = form.querySelector(`.dictionary-editor[data-key="${key}"]`);
            const values = {};
            editor.querySelectorAll('.dictionary-row input[type="text"][data-key]').forEach(input => {
                values[input.dataset.key] = input.value;
            });
            data.details[key] = { ...detail, value: values };
        } else {
            const input = form.querySelector(`#detail-${key}`);
            if (input) {
                data.details[key] = { ...detail, value: input.value };
            }
        }
    }
    
    // Clean up details that were skipped (the indirect links)
    if(asset.type === 'jednotliva-sluzba' && data.details['Agendový informační systém']) {
        delete data.details['Agendový informační systém'].linksTo;
    }
    if(asset.type === 'is' && data.details['Regulované služby']) {
        delete data.details['Regulované služby'].linksTo;
    }


    return data;
}

// Helper function to find an asset by its ID
function findAssetById(data, id, path = '') {
    for (const key in data) {
        if (key === 'name' || key === 'details' || key === 'type') continue;
        const currentPath = path ? `${path}.children.${key}` : key;
        if (key === id) {
            return { asset: data[key], path: currentPath };
        }
        if (data[key].children) {
            const found = findAssetById(data[key].children, id, currentPath);
            if (found) return found;
        }
    }
    return null;
}

// Helper to get all assets of a specific type
function getAllAssetsByType(data, type, path = '') {
    let assets = [];
    for (const key in data) {
        if (key === 'name' || key === 'details' || key === 'type') continue;

        const currentPath = path ? `${path}.children.${key}` : key;
        const asset = data[key];

        if (asset.type === type) {
            assets.push({ asset, path: currentPath });
        }

        if (asset.children) {
            assets = assets.concat(getAllAssetsByType(asset.children, type, currentPath));
        }
    }
    return assets;
}
