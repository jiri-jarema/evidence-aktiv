import { getAllAssets, getParentMap, getSharedOptions, reciprocalMap, getAssetData } from './state.js';

/**
 * Sanitizes text to be used as part of an ID.
 * @param {string} text - The text to sanitize.
 * @returns {string} - The sanitized text.
 */
export function sanitizeForId(text) {
    return text.replace(/[^a-zA-Z0-9-_]/g, '_');
}

/**
 * Flattens the hierarchical asset data into a single object.
 * @param {object} data - The hierarchical data.
 * @returns {object} - The flattened data.
 */
export function flattenData(data) {
    let flat = {};
    for (const key in data) {
        flat[key] = data[key];
        if (data[key].children) {
            Object.assign(flat, flattenData(data[key].children));
        }
    }
    return flat;
}

/**
 * Builds a map of child-to-parent relationships.
 * @param {object} data - The hierarchical data.
 * @param {object} map - The map to populate.
 * @param {string|null} [parent=null] - The parent key.
 */
export function buildParentMap(data, map, parent = null) {
    for (const key in data) {
        map[key] = parent;
        if (data[key].children) {
            buildParentMap(data[key].children, map, key);
        }
    }
}

/**
 * Finds the parent ID of a given child ID.
 * @param {string} childId - The ID of the child.
 * @returns {string|null} - The parent ID.
 */
export function findParentId(childId) {
    return getParentMap()[childId];
}

/**
 * Constructs the database path for a given asset.
 * @param {string} assetId - The ID of the asset.
 * @returns {string} - The database path.
 */
export function getPathForAsset(assetId) {
    let path = [];
    let currentId = assetId;
    while (currentId) {
        path.unshift(currentId);
        currentId = findParentId(currentId);
    }
    return path.join('/children/');
}

/**
 * Retrieves a nested object from a base object using a path string.
 * @param {object} obj - The base object.
 * @param {string} path - The path string (e.g., 'primarni/children/informacni-systemy').
 * @returns {object|null} - The nested object or null if not found.
 */
export function getObjectByPath(obj, path) {
    return path.split('/').reduce((acc, part) => {
        if (part === 'children') {
            return acc ? acc.children : null;
        }
        return acc ? acc[part] : null;
    }, obj);
}

/**
 * Creates a document fragment with clickable links for related assets.
 * @param {string|string[]} linksTo - A single ID or an array of IDs to link to.
 * @param {function} clickHandler - The function to call when a link is clicked.
 * @returns {DocumentFragment} - The fragment containing the links.
 */
export function createLinksFragment(linksTo, clickHandler) {
    const allAssets = getAllAssets();
    const fragment = document.createDocumentFragment();
    
    // Oprava: Zpracuje prázdný řetězec jako prázdné pole
    if (!linksTo || linksTo === "") return fragment;

    const links = Array.isArray(linksTo) ? linksTo : [linksTo];
    links.forEach(linkId => {
        if (!linkId) return;
        const linkedAsset = allAssets[linkId];
        const linkName = (linkedAsset && linkedAsset.name) || linkId;
        const linkWrapper = document.createElement('div');
        const link = document.createElement('a');
        link.textContent = linkName;
        link.className = 'asset-link';
        link.onclick = (e) => {
            e.stopPropagation();
            clickHandler(linkId, findParentId(linkId));
        };
        linkWrapper.appendChild(link);
        fragment.appendChild(linkWrapper);
    });
    return fragment;
}

/**
 * Retrieves connected Agenda Information Systems (AIS) for a given service.
 * Traverses: Service -> Agenda -> Processing Method (AIS) -> Info System
 * @param {string} serviceId - The ID of the regulated service.
 * @returns {Array<{id: string, name: string}>} - Array of connected AIS objects.
 */
export function getConnectedAISForService(serviceId) {
    const allAssets = getAllAssets();
    const service = allAssets[serviceId];
    if (!service) return [];

    const linkedAgendaIds = service.details?.Agendy?.linksTo || [];
    const aisSet = new Map(); // Use Map to avoid duplicates by ID

    linkedAgendaIds.forEach(agendaId => {
        const agenda = allAssets[agendaId];
        if (!agenda) return;

        const processingMethods = agenda.details?.['Způsob zpracování']?.value;
        if (Array.isArray(processingMethods)) {
            processingMethods.forEach(method => {
                if (method.label && method.label.includes('agendový informační systém') && method.checked && method.linksTo) {
                    method.linksTo.forEach(aisId => {
                        if (allAssets[aisId]) {
                            aisSet.set(aisId, { id: aisId, name: allAssets[aisId].name });
                        }
                    });
                }
            });
        }
    });

    return Array.from(aisSet.values());
}

/**
 * Získá bezpečnostní nastavení z připojených informačních systémů pro danou agendu.
 * @param {string} agendaId - ID agendy.
 * @returns {Array<{name: string, options: string[]}>} - Pole objektů s názvem IS a seznamem aktivních voleb.
 */
export function getLinkedISSecurityForAgenda(agendaId) {
    const allAssets = getAllAssets();
    const agenda = allAssets[agendaId];
    if (!agenda) return [];

    const processingMethod = agenda.details?.["Způsob zpracování"]?.value;
    if (!Array.isArray(processingMethod)) return [];

    // Najdi metodu odpovídající AIS
    const aisMethod = processingMethod.find(m => m.label && m.label.includes("agendový informační systém"));
    if (!aisMethod || !aisMethod.linksTo || !Array.isArray(aisMethod.linksTo)) return [];

    const results = [];
    const sharedOptions = getSharedOptions();

    aisMethod.linksTo.forEach(isId => {
        const isAsset = allAssets[isId];
        // Zkontroluj, zda IS existuje a má detail Zabezpečení
        if (isAsset && isAsset.details && isAsset.details["Zabezpečení"]) {
            const secDetail = isAsset.details["Zabezpečení"];
            
            // Urči klíč pro možnosti (fallback na securityElectronic)
            const optionsKey = secDetail.optionsKey || 'securityElectronic';
            const options = sharedOptions[optionsKey];
            const checked = secDetail.checked || secDetail.value || [];
            const details = secDetail.details || {};
            
            const activeOptions = [];
            if (options && Array.isArray(checked)) {
                checked.forEach((isChecked, index) => {
                    if (isChecked && options[index]) {
                        let label = options[index];
                        // Pokud volba obsahuje "Jiné", přidej detail, pokud existuje
                        if (label.toLowerCase().includes('jiné') && details[index]) {
                             label += ` (${details[index]})`;
                        }
                        activeOptions.push(label);
                    }
                });
            }
            
            if (activeOptions.length > 0) {
                results.push({
                    name: isAsset.name,
                    options: activeOptions
                });
            }
        }
    });
    
    return results;
}

/**
 * Identifies reciprocal links that need to be removed when an asset is deleted.
 * @param {string} assetId - ID of the asset being deleted.
 * @returns {object} - Object containing arrays of paths to update ({ simpleLinks: [], agendaLinks: [] }).
 */
export function getReciprocalLinksForDeletion(assetId) {
    const allAssets = getAllAssets();
    const asset = allAssets[assetId];
    if (!asset || !asset.details) return { simpleLinks: [], agendaLinks: [] };

    const assetPath = getPathForAsset(assetId);
    
    // Find matching category in reciprocalMap
    const categoryKey = Object.keys(reciprocalMap).find(key => assetPath.startsWith(key));
    if (!categoryKey) return { simpleLinks: [], agendaLinks: [] };

    const config = reciprocalMap[categoryKey];
    const simpleLinks = [];
    const agendaLinks = [];

    // Iterate through details of the asset being deleted
    for (const key in asset.details) {
        // We only care about fields defined in the reciprocal map
        const mapKey = key.replace(/ /g, '_');
        const linkConfig = config[mapKey];

        if (linkConfig && asset.details[key].linksTo) {
            const linkedIds = asset.details[key].linksTo;
            if (Array.isArray(linkedIds)) {
                linkedIds.forEach(targetId => {
                    // Check if target exists
                    if (allAssets[targetId]) {
                        const targetPath = getPathForAsset(targetId);
                        
                        // Handle Agenda links (special case because of complex "Způsob zpracování" structure)
                        if (linkConfig.targetCategoryPath === 'agendy' && linkConfig.reciprocalField === 'Způsob zpracování') {
                            agendaLinks.push(`${targetPath}/details/Způsob zpracování/value`);
                        } else {
                            // Standard links
                            // OPRAVA: Použít reciprocalField tak, jak je definován v konfiguraci (s podtržítky nebo mezerami),
                            // nenahrazovat automaticky podtržítka mezerami. To je nutné pro pole jako "Provozovane_informacni_systemy".
                            simpleLinks.push(`${targetPath}/details/${linkConfig.reciprocalField}/linksTo`);
                        }
                    }
                });
            }
        }
    }

    return { simpleLinks, agendaLinks };
}