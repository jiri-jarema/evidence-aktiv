import { auth, db } from './firebase.js';
import { setCurrentUser, setUserRole, setUserOdbor, setAssetData, setSharedOptions, setAllAssets, setParentMap } from './state.js';
import { loadInitialData } from './api.js';
import * as dom from './dom.js';
import { flattenData, buildParentMap } from './utils.js';
import { buildNav } from './ui.js';

// POZNÁMKA: Řádek s 'import firebase ...' byl odstraněn. 
// Firebase je načten globálně přes script tagy v index.html a je dostupný jako globální proměnná 'firebase'.

/**
 * Loads all data from the server, processes it, and rebuilds the entire UI.
 * This function serves as the central point for refreshing the application state.
 * @returns {Promise<boolean>} - True if data was loaded and UI was rebuilt successfully, false otherwise.
 */
export async function reloadDataAndRebuildUI() {
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
        return true;
    } else {
        dom.welcomeMessage.querySelector('h2').textContent = 'Chyba při načítání dat';
        dom.welcomeMessage.querySelector('p').textContent = 'Zkuste prosím obnovit stránku. Chyba: ' + result.error.message;
        return false;
    }
}


/**
 * Initializes the application after successful login.
 */
async function initializeApp() {
    await reloadDataAndRebuildUI();
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

    // --- Change Password Logic ---
    
    // Show modal
    if (dom.changePasswordButton) {
        dom.changePasswordButton.addEventListener('click', () => {
            dom.changePasswordModal.classList.remove('hidden');
            dom.changePasswordForm.reset();
            dom.changePasswordError.textContent = '';
        });
    }

    // Hide modal
    if (dom.cancelPasswordChange) {
        dom.cancelPasswordChange.addEventListener('click', () => {
            dom.changePasswordModal.classList.add('hidden');
        });
    }

    // Handle password change submit
    if (dom.changePasswordForm) {
        dom.changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            dom.changePasswordError.textContent = '';

            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                dom.changePasswordError.textContent = 'Nová hesla se neshodují.';
                return;
            }

            const user = auth.currentUser;
            if (!user) return;

            // Re-authenticate user before changing password (security requirement)
            // Používáme globální objekt firebase, který je dostupný díky script tagům v index.html
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

            try {
                await user.reauthenticateWithCredential(credential);
                await user.updatePassword(newPassword);
                alert('Heslo bylo úspěšně změněno.');
                dom.changePasswordModal.classList.add('hidden');
                dom.changePasswordForm.reset();
            } catch (error) {
                console.error("Chyba při změně hesla:", error);
                if (error.code === 'auth/wrong-password') {
                    dom.changePasswordError.textContent = 'Současné heslo není správné.';
                } else if (error.code === 'auth/weak-password') {
                    dom.changePasswordError.textContent = 'Nové heslo je příliš slabé (min. 6 znaků).';
                } else {
                    dom.changePasswordError.textContent = 'Nepodařilo se změnit heslo. Zkuste to prosím znovu.';
                }
            }
        });
    }
}