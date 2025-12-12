import { auth } from '../config/firebase-config.js';
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export class AuthManager {
    constructor() {
        this.user = null;
        this.init();
    }

    init() {
        // Check if config is valid (simple check)
        const isConfigured = auth.app.options.apiKey !== "YOUR_API_KEY";

        if (!isConfigured) {
            console.warn("AuthManager: Firebase not configured. Using Offline Mode.");
            this.updateStatus("Offline Mode");
            this.user = { uid: "offline-user", isAnonymous: true };
            return;
        }

        // Monitor auth state
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.user = user;
                this.updateStatus("Connected (Anonymous)");
            } else {
                this.user = null;
                this.updateStatus("Disconnected");
                // Auto-login if signed out
                this.login();
            }
        });
    }

    async login() {
        const isConfigured = auth.app.options.apiKey !== "YOUR_API_KEY";
        if (!isConfigured) return;

        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("AuthManager: Login failed", error);
            this.updateStatus("Login Failed");
        }
    }

    updateStatus(message) {
        // UI element removed as per user request
        // console.log("Auth Status:", message);
    }
}
