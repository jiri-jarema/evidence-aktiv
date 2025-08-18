// js/main.js
import { initializeApp } from './firebase.js';
import { setupAuth } from './auth.js';
import { state } from './state.js';
import { getData } from './api.js';
import { renderTree, findItemById, flattenServices } from './dom.js';
import * as uiFunctions from './ui.js';

// Zpřístupnění všech funkcí z ui.js globálně, aby je bylo možné volat z HTML
Object.keys(uiFunctions).forEach(key => {
    window[key] = uiFunctions[key];
});

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupAuth(onLogin, onLogout);
});

function onLogin(user) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('user-email').textContent = user.email;

    if (state.userRole === 'administrator') {
        document.getElementById('admin-panel').style.display = 'block';
    }

    loadInitialData();
}

function onLogout() {
    document.getElementById('auth-container').style.display = 'block';
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('user-email').textContent = '';
    document.getElementById('admin-panel').style.display = 'none';
}

function loadInitialData() {
    uiFunctions.showLoading();
    getData()
        .then(data => {
            state.data = data;
            
            // Zpracování a uložení agend do stavu pro snadnější přístup
            if (data.agendy && data.agendy.children) {
                 state.agendas = Object.values(data.agendy.children).flatMap(odbor => 
                    odbor.children ? Object.entries(odbor.children).map(([id, agenda]) => ({ id, ...agenda })) : []
                );
            }

            // Zpracování a uložení služeb do stavu
            const servicesRoot = findItemById(data, 'sluzby');
            if (servicesRoot) {
                state.services = flattenServices(servicesRoot);
            }

            renderTree();
        })
        .catch(error => {
            console.error("Chyba při načítání dat:", error);
            alert("Nepodařilo se načíst data aplikace.");
        })
        .finally(uiFunctions.hideLoading);
}
