import { auth } from './firebase.js';
import { db } from './firebase.js';
import { setCurrentUser, setUserRole, setUserOdbor } from './state.js';
import { loadInitialData } from './api.js';
import * as dom from './dom.js';

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
                
                await loadInitialData();
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
