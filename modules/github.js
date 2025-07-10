import { showAlert, showConfirm } from './alert.js';
import { saveDataToLocalStorage, saveGitHubConfig } from './storage.js';

export function updateGitHubStatus(githubConfig) {
    const statusIndicator = document.getElementById('githubStatus');
    const statusText = document.getElementById('githubStatusText');
    const syncDownBtn = document.getElementById('syncDownBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    if (githubConfig.connected) {
        statusIndicator.className = 'status-indicator status-connected';
        statusText.textContent = `Connected to ${githubConfig.owner}/${githubConfig.repo} (Auto-sync enabled)`;
        syncDownBtn.disabled = false;
        disconnectBtn.disabled = false;
    } else {
        statusIndicator.className = 'status-indicator status-disconnected';
        statusText.textContent = 'Not connected - Tables saved locally only';
        syncDownBtn.disabled = true;
        disconnectBtn.disabled = true;
    }
}

export function updateGitHubUI(githubConfig) {
    if (githubConfig.connected) {
        document.getElementById('githubToken').value = '••••••••••••••••';
        document.getElementById('githubRepo').value = githubConfig.repo;
    }
}

export function logSync(message) {
    const logDiv = document.getElementById('syncLog');
    const logContent = document.getElementById('syncLogContent');
    const timestamp = new Date().toLocaleTimeString();

    logDiv.style.display = 'block';
    logContent.innerHTML += `[${timestamp}] ${message}\n`;
    logContent.scrollTop = logContent.scrollHeight;
}

export async function connectGitHub(githubConfig) {
    const token = document.getElementById('githubToken').value.trim();
    const repo = document.getElementById('githubRepo').value.trim();

    if (!token || !repo) {
        showAlert('Please enter both GitHub token and repository name.', 'warning');
        return githubConfig;
    }

    try {
        logSync('🔗 Connecting to GitHub...');

        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid GitHub token');
        }

        const userData = await userResponse.json();
        logSync(`✅ Authenticated as ${userData.login}`);

        const repoResponse = await fetch(`https://api.github.com/repos/${userData.login}/${repo}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!repoResponse.ok && repoResponse.status === 404) {
            logSync('📁 Creating repository...');
            const createResponse = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repo,
                    description: 'Expense Tracker Data Storage',
                    private: true
                })
            });
            if (!createResponse.ok) {
                throw new Error('Failed to create repository');
            }
            logSync('✅ Repository created successfully');
        }

        githubConfig = {
            token,
            repo,
            owner: userData.login,
            connected: true
        };

        saveGitHubConfig(githubConfig);
        updateGitHubStatus(githubConfig);
        updateGitHubUI(githubConfig);
        logSync('🎉 GitHub connection successful!');
        showAlert('GitHub connected successfully! Tables will now auto-sync to the cloud.', 'success');
        return githubConfig;

    } catch (error) {
        logSync(`❌ Error: ${error.message}`);
        showAlert(`Failed to connect to GitHub: ${error.message}`, 'error');
        return githubConfig;
    }
}

export async function syncFromGitHub(githubConfig, savedTables) {
    if (!githubConfig.connected) {
        showAlert('Please connect to GitHub first.', 'warning');
        return savedTables;
    }

    try {
        logSync('⬇️ Syncing data from GitHub...');

        const response = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/expense-data.json`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                logSync('📄 No data found on GitHub');
                showAlert('No expense data found on GitHub. Save some tables first to create cloud backup.', 'info');
                return savedTables;
            }
            throw new Error('Failed to fetch data from GitHub');
        }

        const fileData = await response.json();
        const decodedData = JSON.parse(atob(fileData.content));

        if (decodedData.savedTables) {
            const mergeData = await showConfirm('Do you want to merge with existing data? Click Cancel to replace all local data.', 'Sync Options');

            if (mergeData) {
                const existingIds = savedTables.map(table => table.id);
                const newTables = decodedData.savedTables.filter(table => !existingIds.includes(table.id));
                savedTables = [...savedTables, ...newTables];
            } else {
                savedTables = decodedData.savedTables;
            }

            saveDataToLocalStorage(savedTables);
            logSync('✅ Data synced successfully from GitHub');
            showAlert('Data synced from GitHub successfully!', 'success');
            return savedTables;
        } else {
            throw new Error('Invalid data format');
        }

    } catch (error) {
        logSync(`❌ Sync error: ${error.message}`);
        showAlert(`Failed to sync from GitHub: ${error.message}`, 'error');
        return savedTables;
    }
}

export async function disconnectGitHub(githubConfig) {
    const confirmed = await showConfirm('Are you sure you want to disconnect from GitHub? This will not delete your cloud data.', 'Disconnect GitHub');
    if (confirmed) {
        githubConfig = {
            token: '',
            repo: '',
            owner: '',
            connected: false
        };
        saveGitHubConfig(githubConfig);
        updateGitHubStatus(githubConfig);
        document.getElementById('githubToken').value = '';
        document.getElementById('githubRepo').value = '';
        logSync('🔌 Disconnected from GitHub');
        showAlert('Disconnected from GitHub successfully.', 'success');
    }
    return githubConfig;
}

export async function autoSyncToGitHub(githubConfig, savedTables) {
    if (!githubConfig.connected) return;
    try {
        const fileResponse = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/expense-data.json`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        let sha = '';
        if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            sha = fileData.sha;
        }

        const response = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/expense-data.json`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: 'Auto-sync expense data',
                content: btoa(JSON.stringify({ savedTables })),
                sha
            })
        });

        if (!response.ok) {
            throw new Error('Failed to sync to GitHub');
        }
        logSync('✅ Auto-synced to GitHub successfully');
    } catch (error) {
        logSync(`❌ Auto-sync error: ${error.message}`);
    }
}
