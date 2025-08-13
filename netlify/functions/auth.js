import { auth, db } from './firebase.js';
import { setCurrentUser, setUserRole, setUserOdbor, setAssetData, setSharedOptions, setAllAssets, setParentMap } from './state.js';
import { loadInitialData } from './api.js';
import * as dom from './dom.js';
import { flattenData, buildParentMap } from './utils.js';
import { buildNav } from './ui.js';

/**
 * Initializes the application after successful data load.
 */
async function initializeApp() {
    const result = await loadInitialData();
    if (result.success) {
        const data = result.data;
        const newAssetData = {
            primarni: data.primarni,
            podpurna: data.podpurna,
            agendy: data.agendy
        };
        
        setAssetData(newAssetData);
        setSharedOptions(data.options);
        
        const flatData = flattenData(newAssetData);
        setAllAssets(flatData);

        const newParentMap = {};
        buildParentMap(newAssetData, newParentMap);
        setParentMap(newParentMap);
        
        dom.sidebar.innerHTML = ''; 
        buildNav(newAssetData, dom.sidebar);

        dom.welcomeMessage.querySelector('h2').textContent = 'Vítejte v evidenci aktiv';
        dom.welcomeMessage.querySelector('p').textContent = 'Vyberte položku z menu vlevo pro zobrazení detailů.';
        dom.welcomeMessage.classList.remove('hidden');
        dom.assetDetailContainer.classList.add('hidden');
    } else {
        dom.welcomeMessage.querySelector('h2').textContent = 'Chyba při načítání dat';
        dom.welcomeMessage.querySelector('p').textContent = 'Zkuste prosím obnovit stránku. Chyba: ' + result.error.message;
    }
}

/**
 * Initializes authentication listeners.
 */
export function initAuth() {
    // Listen for authentication state changes
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            setCurrentUser(user);
            const userRef = db.ref(`users/${user.uid}`);
            const snapshot = await userRef.once('value');
            const userData = snapshot.val();
            
            if (userData && userData.role) {
                setUserRole(userData.role);
                setUserOdbor(userData.odbor || null);
                dom.userInfo.textContent = `${user.email} (role: ${userData.role})`;
                
                dom.loginScreen.classList.add('hidden');
                dom.appContainer.classList.remove('hidden');
                dom.appContainer.classList.add('flex');
                
                await initializeApp();
            } else {
                dom.loginError.textContent = 'Pro váš účet nejsou nastavena oprávnění.';
                auth.signOut();
            }
        } else {
            setCurrentUser(null);
            setUserRole(null);
            setUserOdbor(null);
            dom.loginScreen.classList.remove('hidden');
            dom.appContainer.classList.add('hidden');
            dom.appContainer.classList.remove('flex');
        }
    });

    // Handle login form submission
    dom.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        dom.loginError.textContent = '';
        const email = dom.loginForm.email.value;
        const password = dom.loginForm.password.value;

        auth.signInWithEmailAndPassword(email, password)
            .catch((error) => {
                console.error("Chyba přihlášení:", error);
                dom.loginError.textContent = 'Nesprávné jméno nebo heslo.';
            });
    });

    // Handle logout button click
    dom.logoutButton.addEventListener('click', () => {
        auth.signOut();
    });
}
