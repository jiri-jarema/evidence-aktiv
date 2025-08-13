import * as dom from './dom.js';
import * as auth from './auth.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';

// --- Main Data Fetching and Rendering ---

/**
 * Fetches data from the API and renders it in the UI.
 * This function is now exported to be accessible from other modules like auth.js.
 */
export async function fetchDataAndRender() {
    try {
        ui.showLoading();
        const data = await api.getData();
        state.setAllData(data);
        ui.renderData(data);
    } catch (error) {
        console.error("Error fetching or rendering data:", error);
        ui.showError("Nepodařilo se načíst data.");
    } finally {
        ui.hideLoading();
    }
}


// --- Initialization ---

/**
 * Initializes the application.
 */
function initializeApp() {
    dom.setupEventListeners();
    auth.initializeAuth();
    // Initial data fetch is now handled by the auth state change listener
    // which calls the exported fetchDataAndRender function.
}

// Start the application
initializeApp();
