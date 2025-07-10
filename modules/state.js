export class AppState {
    constructor() {
        this.expenses = [];
        this.editingExpenseId = null;
        this.savedTables = [];
        this.activeTableId = null;
        this.currentPage = 1;
        this.itemsPerPage = 10;
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
