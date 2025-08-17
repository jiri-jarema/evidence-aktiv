// js/state.js

// The global state object for the application
let state = {
    data: null,
    selectedAssetPath: null,
    isEditing: false,
    user: null,
    userRole: null,
    options: {
        personalDataCategories: [
            "Jméno a příjmení",
            "Datum narození",
            "Rodné číslo",
            "Adresa",
            "Kontakt (telefon, e-mail)",
            "Bankovní spojení",
            "IP adresa",
            "Cookies",
            "Jiné"
        ],
        recipientCategories: [
            "Orgány veřejné moci",
            "Zdravotní pojišťovny",
            "Banky",
            "Exekutoři",
            "Jiné"
        ]
    }
};

/**
 * Updates the global state by merging the new state with the existing state.
 * @param {object} newState - An object containing the new state properties to merge.
 */
function setState(newState) {
    state = { ...state, ...newState };
}

// Export the state object and the setState function to make them available to other modules.
export { state, setState };
