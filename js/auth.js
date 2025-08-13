import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import * as api from './api.js';
import * as ui from './ui.js';
import * as state from './state.js';
import { fetchDataAndRender } from './main.js';

let auth;

/**
 * Initializes Firebase authentication and sets up an observer for auth state changes.
 */
export function initializeAuth() {
    auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
        ui.hideLoading();
        if (user) {
            // User is signed in.
            await handleLogin(user);
        } else {
            // User is signed out.
            handleLogout();
        }
        // Update the login state in the UI (e.g., show/hide login/logout buttons).
        ui.updateLoginState(user);
    });
}

/**
 * Handles the user login process.
 * @param {object} user - The user object from Firebase Auth.
 */
async function handleLogin(user) {
    try {
        ui.showLoading();
        // FIX: Destructure the 'role' property from the object returned by the API.
        const { role } = await api.getUserRole();
        
        // Set the user's role in the application state.
        state.setUserRole(role);
        
        // Update the UI visibility based on the user's role (e.g., show admin buttons).
        ui.updateUIVisibility(role);
        
        // Fetch the main application data and render it.
        await fetchDataAndRender();
    } catch (error) {
        console.error("Login handling failed:", error);
        ui.showError("Nepodařilo se dokončit přihlášení.");
    } finally {
        ui.hideLoading();
    }
}

/**
 * Handles the user logout process.
 */
function handleLogout() {
    // Reset the user role in the state.
    state.setUserRole('user'); 
    // Clear any displayed data.
    ui.clearData();
    // Update UI elements to reflect the logged-out state.
    ui.updateUIVisibility('user');
}

/**
 * Signs in a user with email and password.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 */
export async function signIn(email, password) {
    try {
        ui.showLoading();
        await signInWithEmailAndPassword(auth, email, password);
        ui.closeModal('login-modal');
    } catch (error) {
        console.error("Sign in failed:", error);
        ui.showError(`Přihlášení selhalo: ${error.message}`);
    } finally {
        ui.hideLoading();
    }
}

/**
 * Signs out the current user.
 */
export async function logOut() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Sign out failed:", error);
        ui.showError(`Odhlášení selhalo: ${error.message}`);
    }
}

/**
 * Function to get the current authenticated user.
 * @returns {object|null} The current user object or null if not signed in.
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Re-fetches all data and rebuilds the UI.
 * This function is exported to be used from the UI module (ui.js) 
 * to trigger a data refresh after operations like creating or editing users.
 */
export async function reloadDataAndRebuildUI() {
    await fetchDataAndRender();
}
