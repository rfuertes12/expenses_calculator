export class AppState {
    constructor() {
        this.expenses = [];
        this.editingExpenseId = null;
        this.savedTables = [];
        this.currentTab = 'current';
        this.githubConfig = {
            token: '',
            repo: '',
            owner: '',
            connected: false
        };
    }
}

export const state = new AppState();
