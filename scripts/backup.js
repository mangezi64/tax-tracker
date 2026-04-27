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

            // Load Google API (gapi)
            await this.loadGoogleAPI();

            // Load Google Identity Services (GIS)
            await this.loadGIS();

            console.log('Google API loaded, initializing client...');

            // Initialize gapi client
            await new Promise((resolve, reject) => {
                gapi.load('client', async () => {
                    try {
                        await gapi.client.init({
                            apiKey: this.API_KEY,
                            discoveryDocs: this.DISCOVERY_DOCS,
                        });
                        console.log('gapi client initialized');
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            // Initialize GIS Token Client
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error !== undefined) {
                        throw (response);
                    }
                    this.updateSigninStatus(true);
                    expenseManager.showToast('Signed in to Google Drive', 'success');
                },
            });

            console.log('GIS Token Client initialized');

            // Check if we have a stored token (optional, for now we start signed out)
            this.updateSigninStatus(false);

            return true;

        } catch (error) {
            console.error('Error initializing Google Drive:', error);
            alert('Failed to initialize Google Drive: ' + (error.message || error.toString()));
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
     * Load Google Identity Services script
     */
    loadGIS() {
        return new Promise((resolve, reject) => {
            if (typeof google !== 'undefined' && google.accounts) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
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
        const restoreBtn = document.getElementById('google-restore-btn');

        if (signInBtn && signOutBtn) {
            if (isSignedIn) {
                signInBtn.style.display = 'none';
                signOutBtn.style.display = 'inline-flex';
                if (syncBtn) syncBtn.disabled = false;
                if (restoreBtn) restoreBtn.disabled = false;

                // Check for newer backup
                this.checkForNewerBackup();
            } else {
                signInBtn.style.display = 'inline-flex';
                signOutBtn.style.display = 'none';
                if (syncBtn) syncBtn.disabled = true;
                if (restoreBtn) restoreBtn.disabled = true;
            }
        }
    }

    /**
     * Sign in to Google
     */
    async signInGoogle() {
        try {
            if (gapi.client.getToken() === null) {
                // Prompt the user to select a Google Account and ask for consent to share their data
                // when establishing a new session.
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                // Skip display of account chooser and consent dialog for an existing session.
                this.tokenClient.requestAccessToken({ prompt: '' });
            }
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
            const token = gapi.client.getToken();
            if (token !== null) {
                google.accounts.oauth2.revoke(token.access_token);
                gapi.client.setToken('');
            }
            this.updateSigninStatus(false);
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
                    headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
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
     * Check for newer backup on Google Drive
     */
    async checkForNewerBackup() {
        if (!this.googleSignedIn) return;

        try {
            // Get last local backup date
            const lastLocalBackup = await db.getSetting('lastGoogleDriveBackupDate');

            // List latest backup file
            const response = await gapi.client.drive.files.list({
                q: "name contains 'tax-tracker-backup' and mimeType='application/json' and trashed=false",
                fields: 'files(id, name, createdTime)',
                orderBy: 'createdTime desc',
                pageSize: 1
            });

            const files = response.result.files;
            if (!files || files.length === 0) return;

            const latestCloudBackup = files[0];
            const cloudDate = new Date(latestCloudBackup.createdTime);

            // If we have no local record, or cloud is newer than local record
            // We add a small buffer (1 minute) to avoid prompting for the backup we just made
            const localDate = lastLocalBackup ? new Date(lastLocalBackup) : new Date(0);

            // Check if cloud is significantly newer (more than 1 minute)
            if (cloudDate > new Date(localDate.getTime() + 60000)) {
                const shouldRestore = confirm(
                    `🔄 Cloud Sync Found\n\n` +
                    `We found a newer backup on Google Drive from ${cloudDate.toLocaleString()}.\n\n` +
                    `Do you want to restore this data?`
                );

                if (shouldRestore) {
                    await this.restoreFile(latestCloudBackup.id);
                }
            }
        } catch (error) {
            console.error('Error checking for backups:', error);
        }
    }

    /**
     * Restore specific file by ID
     */
    async restoreFile(fileId) {
        try {
            expenseManager.showToast('Downloading backup...', 'info');

            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            const data = response.result;

            // Import data
            await db.importData(data);

            expenseManager.showToast('Data restored successfully!', 'success');

            // Update local record
            await db.setSetting('lastGoogleDriveBackupDate', new Date().toISOString());

            // Refresh UI
            await dashboardManager.refreshDashboard();
            await expenseManager.renderExpenseTable();

        } catch (error) {
            console.error('Restore error:', error);
            alert('Failed to restore backup: ' + error.message);
        }
    }

    /**
     * Restore from Google Drive (Manual)
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
