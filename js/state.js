// This file manages the global state of the application.

let currentUser = null;
let userRole = null;
let userOdbor = null;
let assetData = {};
let sharedOptions = {};
let allAssets = {};
let parentMap = {};

// Constants
export const detailOrder = [
    "Garant", "Účel zpracování", "Zákonnost zpracování", "Legislativa", "Způsob zpracování",
    "Zdroje osobních údajů", "Kategorie osobních údajů", "Zvláštní kategorie osobních údajů",
    "Lhůty pro výmaz", "Zpracovatel", "Jmenný seznam oprávněných osob",
    "Kategorie příjemců osobních údajů", "Propojení na jiné správce nebo zpracovatele",
    "Předávání osobních údajů do třetí země", "Zabezpečení zpracování - elektronické",
    "Zabezpečení zpracování - analogové"
];

export const reciprocalMap = {
    'podpurna/children/databaze': {
        'Agendy_uzivajici_DB': {
            targetCategoryPath: 'primarni/children/informacni-systemy',
            reciprocalField: 'Databáze'
        }
    },
    'podpurna/children/servery': {
        'Provozovane_databaze': {
            targetCategoryPath: 'podpurna/children/databaze',
            reciprocalField: 'Server'
        },
        'Provozovane_aplikace': {
            targetCategoryPath: 'primarni/children/informacni-systemy',
            reciprocalField: 'Aplikační_server'
        }
    },
    'primarni/children/informacni-systemy': {
        'Databáze': {
            targetCategoryPath: 'podpurna/children/databaze',
            reciprocalField: 'Agendy_uzivajici_DB'
        },
        'Aplikační_server': {
            targetCategoryPath: 'podpurna/children/servery',
            reciprocalField: 'Provozovane_aplikace'
        }
    }
};

// Getters
export const getCurrentUser = () => currentUser;
export const getUserRole = () => userRole;
export const getUserOdbor = () => userOdbor;
export const getAssetData = () => assetData;
export const getSharedOptions = () => sharedOptions;
export const getAllAssets = () => allAssets;
export const getParentMap = () => parentMap;

// Setters
export const setCurrentUser = (user) => { currentUser = user; };
export const setUserRole = (role) => { userRole = role; };
export const setUserOdbor = (odbor) => { userOdbor = odbor; };
export const setAssetData = (data) => { assetData = data; };
export const setSharedOptions = (options) => { sharedOptions = options; };
export const setAllAssets = (assets) => { allAssets = assets; };
export const setParentMap = (map) => { parentMap = map; };
