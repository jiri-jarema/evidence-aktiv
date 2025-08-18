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
    "Zabezpečení zpracování - analogové", "Regulované služby"
];

// Nově přidané konstanty pro sjednocení pořadí
export const serviceDetailOrder = [
    "Legislativa", "Agendy"
];

export const infoSystemDetailOrder = [
    "Popis", "Vlastník", "SpravceNeboZastupce", "Uživatelé", "Stav aktiva", "Koncepce",
    "Přístup", "Nedostupnost", "Klasifikace informací", "Aplikační server", "Databaze",
    "Sítě", "Agendy", "Zabezpečení"
];

export const defaultSupportAssetOrder = [
    "Vlastnik", "Spravce_zastupce", "Stav_aktiva", "Datum_porizeni", "Termin_obnovy", "SLA", "Model",
    "Funkce", "Operacni_system", "Vybaveni", "Provozovane_informacni_systemy", "Provozovane_databaze",
    "Informacni_systemy_vyuzivajici_DB", "Server", "Cil_zalohovani", "Frekvence_zalohovani", "Verze",
    "Informacni_systemy", "Poznamka"
];


export const reciprocalMap = {
    'agendy': {
        'Regulované_služby': {
            targetCategoryPath: 'primarni/children/sluzby',
            reciprocalField: 'Agendy'
        }
    },
    'podpurna/children/databaze': {
        'Informacni_systemy_vyuzivajici_DB': {
            targetCategoryPath: 'primarni/children/informacni-systemy',
            reciprocalField: 'Databaze'
        },
        'Cil_zalohovani': {
            targetCategoryPath: 'podpurna/children/servery',
            reciprocalField: 'Zalohovane_databaze'
        },
        'Server': {
            targetCategoryPath: 'podpurna/children/servery',
            reciprocalField: 'Provozovane_databaze'
        }
    },
    'podpurna/children/servery': {
        'Provozovane_databaze': {
            targetCategoryPath: 'podpurna/children/databaze',
            reciprocalField: 'Server'
        },
        'Provozovane_informacni_systemy': {
            targetCategoryPath: 'primarni/children/informacni-systemy',
            reciprocalField: 'Aplikační_server'
        },
        'Zalohovane_databaze': {
             targetCategoryPath: 'podpurna/children/databaze',
             reciprocalField: 'Cil_zalohovani'
        }
    },
    'podpurna/children/site': {
        'Informacni_systemy': {
            targetCategoryPath: 'primarni/children/informacni-systemy',
            reciprocalField: 'Sítě'
        }
    },
    'primarni/children/informacni-systemy': {
        'Agendy': {
            targetCategoryPath: 'agendy',
            reciprocalField: 'Způsob zpracování'
        },
        'Databaze': {
            targetCategoryPath: 'podpurna/children/databaze',
            reciprocalField: 'Informacni_systemy_vyuzivajici_DB'
        },
        'Aplikační_server': {
            targetCategoryPath: 'podpurna/children/servery',
            reciprocalField: 'Provozovane_informacni_systemy'
        },
        'Sítě': {
            targetCategoryPath: 'podpurna/children/site',
            reciprocalField: 'Informacni_systemy'
        }
    },
    'primarni/children/sluzby': {
        'Agendy': {
            targetCategoryPath: 'agendy',
            reciprocalField: 'Regulované služby'
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