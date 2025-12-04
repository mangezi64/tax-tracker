/**
 * Backup & Restore Module
 * Handles data export/import and Google Drive integration
 */

class BackupManager {
    constructor() {
        this.CLIENT_ID = null; // User will need to set this
        this.API_KEY = null; // User will need to set this
        this.DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.googleSignedIn = false;
    }

    /**
     * Export all data as JSON file
     */
    async exportData() {
        try {
            const data = await db.exportData();

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `tax-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            expenseManager.showToast('Data exported successfully!', 'success');
            return true;
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data: ' + error.message);
            return false;
        }
    }

    /**
     * Import data from JSON file
     */
    async importData() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('No file selected'));
                    return;
                }

                try {
                    const text = await file.text();
                    const data = JSON.parse(text);

                    // Validate data structure
                    if (!data.expenses || !data.categories) {
                        throw new Error('Invalid backup file format');
                    }

                    // Confirm with user
                    const confirmed = confirm(
                        `This will replace all current data with the backup from ${data.exportDate}.\n\n` +
                        `Backup contains:\n` +
                        `- ${data.expenses.length} expenses\n` +
                        `- ${data.categories.length} categories\n\n` +
                        `Continue?`
                    );

                    if (!confirmed) {
                        reject(new Error('Import cancelled by user'));
                        return;
                    }

                    // Import data
                    await db.importData(data);

                    expenseManager.showToast('Data imported successfully!', 'success');

                    // Refresh the UI
                    await dashboardManager.refreshDashboard();
                    await expenseManager.renderExpenseTable();

                    resolve(true);
                } catch (error) {
                    console.error('Import error:', error);
                    alert('Failed to import data: ' + error.message);
                    reject(error);
                }
            };

            input.click();
        });
    }

    /**
   * Initialize Google Drive API
   */
    async initGoogleDrive() {
        if (!this.CLIENT_ID || !this.API_KEY) {
            alert(
                'Google Drive integration requires API credentials.\n\n' +
                'Please follow the setup instructions in Settings to configure Google Drive backup.'
            );
            return false;
        }

        try {
            console.log('Loading Google API...');

            // Load Google API
            await this.loadGoogleAPI();

            console.log('Google API loaded, initializing client...');

            // Wait for gapi to be ready
            await new Promise((resolve, reject) => {
                if (typeof gapi === 'undefined') {
                    reject(new Error('Google API (gapi) not loaded. Please check your internet connection.'));
                    return;
                }

                gapi.load('client:auth2', async () => {
                    try {
                        console.log('Initializing gapi client...');

                        await gapi.client.init({
                            apiKey: this.API_KEY,
                            clientId: this.CLIENT_ID,
                            discoveryDocs: this.DISCOVERY_DOCS,
                            scope: this.SCOPES
                        });

                        console.log('gapi client initialized successfully');

                        // Listen for sign-in state changes
                        gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus.bind(this));

                        // Handle the initial sign-in state
                        this.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

                        resolve();
                    } catch (error) {
                        console.error('Error in gapi.client.init:', error);
                        reject(error);
                    }
                });
            });

            console.log('Google Drive API initialized successfully');
            return true;

        } catch (error) {
            console.error('Error initializing Google Drive:', error);
            const errorMessage = error.message || error.toString() || 'Unknown error';
            alert(
                'Failed to initialize Google Drive.\n\n' +
                'Error: ' + errorMessage + '\n\n' +
                'Please check:\n' +
                '1. Your internet connection\n' +
                '2. Your Client ID and API Key are correct\n' +
                '3. Browser console (F12) for more details'
            );
            return false;
        }
    }

    /**
     * Load Google API script
     */
    loadGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (typeof gapi !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Update Google sign-in status
     */
    updateSigninStatus(isSignedIn) {
        this.googleSignedIn = isSignedIn;

        const signInBtn = document.getElementById('google-signin-btn');
        const signOutBtn = document.getElementById('google-signout-btn');
        const syncBtn = document.getElementById('google-sync-btn');

        if (signInBtn && signOutBtn) {
            if (isSignedIn) {
                signInBtn.style.display = 'none';
                signOutBtn.style.display = 'inline-flex';
                if (syncBtn) syncBtn.disabled = false;
            } else {
                signInBtn.style.display = 'inline-flex';
                signOutBtn.style.display = 'none';
                if (syncBtn) syncBtn.disabled = true;
            }
        }
    }

    /**
     * Sign in to Google
     */
    async signInGoogle() {
        try {
            await gapi.auth2.getAuthInstance().signIn();
            expenseManager.showToast('Signed in to Google Drive', 'success');
        } catch (error) {
            console.error('Sign-in error:', error);
            alert('Failed to sign in: ' + error.message);
        }
    }

    /**
     * Sign out from Google
     */
    async signOutGoogle() {
        try {
            await gapi.auth2.getAuthInstance().signOut();
            expenseManager.showToast('Signed out from Google Drive', 'success');
        } catch (error) {
            console.error('Sign-out error:', error);
        }
    }

    /**
     * Backup to Google Drive
     */
    async backupToGoogleDrive() {
        if (!this.googleSignedIn) {
            alert('Please sign in to Google Drive first');
            return false;
        }

        try {
            const data = await db.exportData();
            const jsonString = JSON.stringify(data, null, 2);

            const fileName = `tax-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
            const fileMetadata = {
                name: fileName,
                mimeType: 'application/json'
            };

            const file = new Blob([jsonString], { type: 'application/json' });
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
                    body: form
                }
            );

            if (!response.ok) {
                throw new Error('Failed to upload to Google Drive');
            }

            const result = await response.json();
            expenseManager.showToast('Backed up to Google Drive successfully!', 'success');

            // Save the file ID for future reference
            await db.setSetting('lastGoogleDriveBackupId', result.id);
            await db.setSetting('lastGoogleDriveBackupDate', new Date().toISOString());

            return true;
        } catch (error) {
            console.error('Backup error:', error);
            alert('Failed to backup to Google Drive: ' + error.message);
            return false;
        }
    }

    /**
     * Restore from Google Drive
     */
    async restoreFromGoogleDrive() {
        if (!this.googleSignedIn) {
            alert('Please sign in to Google Drive first');
            return false;
        }

        try {
            // List backup files
            const response = await gapi.client.drive.files.list({
                q: "name contains 'tax-tracker-backup' and mimeType='application/json'",
                fields: 'files(id, name, createdTime)',
                orderBy: 'createdTime desc',
                pageSize: 10
            });

            const files = response.result.files;
            if (!files || files.length === 0) {
                alert('No backup files found in Google Drive');
                return false;
            }

            // Show file selection dialog
            const fileList = files.map((f, i) =>
                `${i + 1}. ${f.name} (${new Date(f.createdTime).toLocaleString()})`
            ).join('\n');

            const selection = prompt(
                `Select a backup file to restore (enter number 1-${files.length}):\n\n${fileList}`
            );

            if (!selection) return false;

            const index = parseInt(selection) - 1;
            if (index < 0 || index >= files.length) {
                alert('Invalid selection');
                return false;
            }

            const selectedFile = files[index];

            // Download file content
            const fileResponse = await gapi.client.drive.files.get({
                fileId: selectedFile.id,
                alt: 'media'
            });

            const data = JSON.parse(fileResponse.body);

            // Confirm restore
            const confirmed = confirm(
                `Restore from backup: ${selectedFile.name}?\n\n` +
                `This will replace all current data.\n\n` +
                `Backup contains:\n` +
                `- ${data.expenses.length} expenses\n` +
                `- ${data.categories.length} categories\n\n` +
                `Continue?`
            );

            if (!confirmed) return false;

            // Import data
            await db.importData(data);

            expenseManager.showToast('Restored from Google Drive successfully!', 'success');

            // Refresh UI
            await dashboardManager.refreshDashboard();
            await expenseManager.renderExpenseTable();

            return true;
        } catch (error) {
            console.error('Restore error:', error);
            alert('Failed to restore from Google Drive: ' + error.message);
            return false;
        }
    }

    /**
     * Set Google API credentials
     */
    setGoogleCredentials(clientId, apiKey) {
        this.CLIENT_ID = clientId;
        this.API_KEY = apiKey;

        // Save to settings
        db.setSetting('googleClientId', clientId);
        db.setSetting('googleApiKey', apiKey);
    }

    /**
     * Load saved credentials
     */
    async loadSavedCredentials() {
        const clientId = await db.getSetting('googleClientId');
        const apiKey = await db.getSetting('googleApiKey');

        if (clientId) this.CLIENT_ID = clientId;
        if (apiKey) this.API_KEY = apiKey;
    }
}

// Create singleton instance
const backupManager = new BackupManager();

// Export
window.backupManager = backupManager;
