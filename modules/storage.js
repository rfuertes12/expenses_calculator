export function loadSavedData(savedTables) {
    try {
        const savedData = localStorage.getItem('expenseTrackerHistory');
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            const retentionDays = 150;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            const filtered = parsedData.filter(table => {
                const savedDate = new Date(table.savedDate);
                return savedDate >= cutoffDate;
            }).map(table => {
                table.expenses = table.expenses.map(exp => ({
                    ...exp,
                    settled: exp.settled || false
                }));
                return table;
            });
            localStorage.setItem('expenseTrackerHistory', JSON.stringify(filtered));
            return filtered;
        }
    } catch (error) {
        console.log('Error loading saved data:', error);
    }
    return [];
}

export function saveDataToLocalStorage(savedTables) {
    try {
        localStorage.setItem('expenseTrackerHistory', JSON.stringify(savedTables));
    } catch (error) {
        console.log('Error saving data:', error);
        // showAlert is imported by caller if needed
    }
}

export function loadGitHubConfig() {
    try {
        const config = localStorage.getItem('expenseTrackerGitHubConfig');
        if (config) {
            return JSON.parse(config);
        }
    } catch (error) {
        console.log('Error loading GitHub config:', error);
    }
    return { token: '', repo: '', owner: '', connected: false };
}

export function saveGitHubConfig(githubConfig) {
    try {
        localStorage.setItem('expenseTrackerGitHubConfig', JSON.stringify(githubConfig));
    } catch (error) {
        console.log('Error saving GitHub config:', error);
    }
}
