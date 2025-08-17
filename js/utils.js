// js/utils.js
import { state } from './state.js';

/**
 * Finds an asset in the data tree using its string path.
 * e.g., 'primarni-aktiva.children.regulovane-sluzby'
 * @param {object} data - The root of the data tree.
 * @param {string} path - The path to the asset.
 * @returns {object|null} The asset object or null if not found.
 */
export function findAssetByPath(data, path) {
    if (!path) return null;
    const pathParts = path.split('.children.');
    let currentAsset = data;
    for (const part of pathParts) {
        if (currentAsset && currentAsset[part]) {
            currentAsset = currentAsset[part];
        } else if (currentAsset && currentAsset.children && currentAsset.children[part]) {
            currentAsset = currentAsset.children[part];
        } else {
            return null;
        }
    }
    return currentAsset;
}

/**
 * Retrieves a list of options from the global state.
 * @param {string} key - The key for the options array in state.options.
 * @returns {Array} The array of options.
 */
export function getOptions(key) {
    return state.options[key] || [];
}

/**
 * Recursively finds all assets of a specific type in the data tree.
 * @param {object} data - The data object to search through.
 * @param {string} type - The asset type to find (e.g., 'is', 'agenda').
 * @param {string} path - The current path in the recursion.
 * @returns {Array} An array of objects, each containing the asset and its path.
 */
export function getAllAssetsByType(data, type, path = '') {
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

/**
 * Recursively finds an asset by its unique ID (the object key).
 * @param {object} data - The data object to search through.
 * @param {string} id - The ID of the asset to find.
 * @param {string} path - The current path in the recursion.
 * @returns {object|null} An object with the asset and its path, or null.
 */
export function findAssetById(data, id, path = '') {
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
