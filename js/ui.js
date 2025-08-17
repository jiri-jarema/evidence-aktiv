import { state, setState } from './state.js';
import { findAssetByPath, getOptions, getAllAssetsByType, findAssetById } from './utils.js';

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

// REVISED Function to create the form for editing an asset
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

            const isServiceToIsLink = asset.type === 'jednotliva-sluzba' && key === 'Agendový informační systém';
            const isIsToServiceLink = asset.type === 'is' && key === 'Regulované služby';

            if (isServiceToIsLink) {
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
            } else if (isIsToServiceLink) {
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
            } else if (detail.linksTo) {
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


// REVISED Function to collect form data
export function getFormData(form) {
    const formData = new FormData(form);
    const data = {
        name: formData.get('asset-name'),
        details: {}
    };

    const asset = findAssetByPath(state.data, state.selectedAssetPath);
    if (!asset.details) return data;

    // Deep copy details to avoid mutating the original state object directly
    const newDetails = JSON.parse(JSON.stringify(asset.details));

    for (const key in newDetails) {
        const detail = newDetails[key];
        const inputName = `detail-${key.replace(/\s+/g, '-')}`;

        const isServiceToIsLink = asset.type === 'jednotliva-sluzba' && key === 'Agendový informační systém';
        const isIsToServiceLink = asset.type === 'is' && key === 'Regulované služby';

        if (isServiceToIsLink || isIsToServiceLink) {
            // This is an indirect link. Ensure any old direct `linksTo` array is removed upon saving.
            if (detail.linksTo) {
                delete detail.linksTo;
            }
        } else if (detail.linksTo) {
            // This is a direct, editable link (e.g., Agendas). Read its value from the form.
            const select = form.querySelector(`#${inputName}`);
            if (select) {
                detail.linksTo = Array.from(select.selectedOptions).map(opt => opt.value);
            }
        } else if (detail.type === 'checkbox-list' || detail.type === 'radio-list') {
            const inputs = form.querySelectorAll(`input[name="${inputName}"]`);
            detail.checked = Array.from(inputs).map(input => input.checked);
        } else if (detail.type === 'dictionary') {
            const editor = form.querySelector(`.dictionary-editor[data-key="${key}"]`);
            const values = {};
            editor.querySelectorAll('.dictionary-row input[type="text"][data-key]').forEach(input => {
                values[input.dataset.key] = input.value;
            });
            detail.value = values;
        } else {
            // Standard text input
            const input = form.querySelector(`#detail-${key}`);
            if (input) {
                detail.value = input.value;
            }
        }
    }

    data.details = newDetails;
    return data;
}
