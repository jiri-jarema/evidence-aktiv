// Import firebase.js jako první, aby se zajistila inicializace Firebase
// předtím, než ho ostatní moduly začnou používat.
import './firebase.js';

import * as dom from './dom.js';
import * as auth from './auth.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';

// --- Hlavní načítání a vykreslování dat ---

/**
 * Načte data z API a vykreslí je v UI.
 * Tato funkce je nyní exportována, aby byla přístupná z jiných modulů, jako je auth.js.
 */
export async function fetchDataAndRender() {
    try {
        ui.showLoading();
        const data = await api.getData();
        state.setAllData(data);
        ui.renderData(data);
    } catch (error) {
        console.error("Chyba při načítání nebo vykreslování dat:", error);
        ui.showError("Nepodařilo se načíst data.");
    } finally {
        ui.hideLoading();
    }
}


// --- Inicializace ---

/**
 * Inicializuje aplikaci.
 */
function initializeApp() {
    // Modul dom.js si nyní po importu sám nastavuje posluchače událostí.
    // Proto je explicitní volání zde odstraněno, aby se předešlo chybě.
    auth.initializeAuth();
    // Počáteční načtení dat je řešeno posluchačem změny stavu autentizace,
    // který volá exportovanou funkci fetchDataAndRender.
}

// Spuštění aplikace
initializeApp();
