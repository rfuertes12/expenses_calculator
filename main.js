import { showAlert, closeAlert, showConfirm, showToast } from "./modules/alert.js";
import { loadSavedData, saveDataToLocalStorage, loadGitHubConfig, saveGitHubConfig } from "./modules/storage.js";
import { updateGitHubStatus, updateGitHubUI, logSync, connectGitHub, syncFromGitHub, autoSyncToGitHub, disconnectGitHub } from "./modules/github.js";
import { downloadCSV } from "./modules/csv.js";
import { state } from "./modules/state.js";

let refreshAfterSave = false;



async function connectGitHubWrapper() {
    state.githubConfig = await connectGitHub(state.githubConfig);
}

async function syncFromGitHubWrapper() {
    state.savedTables = await syncFromGitHub(state.githubConfig, state.savedTables);
    updateHistoryView();
}

async function disconnectGitHubWrapper() {
    state.githubConfig = await disconnectGitHub(state.githubConfig);
}

function switchTab(tabName) {
    // Update tab buttons
    const tabs = ['current', 'history', 'sync'];
    tabs.forEach((tab, index) => {
        document.querySelector(`.tab:nth-child(${index + 1})`).classList.toggle('active', tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    state.currentTab = tabName;
    
    if (tabName === 'history') {
        updateHistoryView();
    } else if (tabName === 'sync') {
        updateGitHubStatus(state.githubConfig);
    }
}

function openModal() {
    if (state.editingExpenseId) {
        showAlert('Please save or cancel the current edit before adding a new expense.', 'warning');
        return;
    }
    document.getElementById('expenseModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('expenseModal').style.display = 'none';
    refreshForm();
}

function refreshForm() {
    document.getElementById('expenseForm').reset();
}

function addExpense(biller, description, amount, dueDate) {
    const expense = {
        id: Date.now(),
        biller: biller,
        description: description,
        amount: parseFloat(amount),
        dueDate: dueDate,
        settled: false
    };
    state.expenses.push(expense);
    updateTable();
    autoSaveActiveTable();
}

function updateTable() {
    const tableContent = document.getElementById('tableContent');

    if (state.expenses.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No expenses added yet</h3>
                <p>Click "Add New Expense" to get started</p>
            </div>
        `;
        document.getElementById('totalAmountDisplay').textContent = '₱0.00';
        document.getElementById('settledAmountDisplay').textContent = '₱0.00';
        return;
    }

    // Sort expenses by due date (earliest first)
    const sortedExpenses = [...state.expenses].sort((a, b) => {
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    const total = state.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalSettled = state.expenses.reduce((sum, expense) => expense.settled ? sum + expense.amount : sum, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Biller</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Priority</th>
                    <th>Settled</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedExpenses.forEach(expense => {
        const dueDate = new Date(expense.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let priorityBadge = '';
        let rowClass = '';
        let dueDateClass = 'due-date';
        
        if (daysDiff < 0) {
            priorityBadge = '<span class="priority-badge" style="background: #dc3545;">OVERDUE</span>';
            rowClass = 'priority-high';
            dueDateClass = 'due-date overdue';
        } else if (daysDiff <= 10) {
            priorityBadge = '<span class="priority-badge">HIGH</span>';
            rowClass = 'priority-high';
        }
        
        const formattedDate = new Date(expense.dueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const isEditing = state.editingExpenseId === expense.id;
        if (expense.settled) {
            rowClass += ' settled-row';
        }
        if (isEditing) {
            rowClass += ' editing-row';
        }
        
        if (isEditing) {
            tableHTML += `
                <tr class="${rowClass}">
                    <td data-label="Biller"><input type="text" class="editable-input" id="edit-biller-${expense.id}" value="${expense.biller}"></td>
                    <td data-label="Description"><input type="text" class="editable-input" id="edit-description-${expense.id}" value="${expense.description}"></td>
                    <td data-label="Amount"><input type="number" class="editable-input" id="edit-amount-${expense.id}" value="${expense.amount}" step="0.01" min="0"></td>
                    <td data-label="Due Date"><input type="date" class="editable-input" id="edit-dueDate-${expense.id}" value="${expense.dueDate}"></td>
                    <td data-label="Priority">${priorityBadge}</td>
                    <td data-label="Settled"><input type="checkbox" ${expense.settled ? 'checked' : ''} disabled></td>
                    <td data-label="Action">
                        <button class="btn btn-save" style="padding: 4px 8px; font-size: 11px; margin-right: 3px;" onclick="saveEdit(${expense.id})">💾</button>
                        <button class="btn btn-cancel-edit" style="padding: 4px 8px; font-size: 11px;" onclick="cancelEdit()">❌</button>
                    </td>
                </tr>
            `;
        } else {
            tableHTML += `
                <tr class="${rowClass}">
                    <td data-label="Biller">${expense.biller}</td>
                    <td data-label="Description">${expense.description}</td>
                    <td data-label="Amount" class="amount">₱${expense.amount.toFixed(2)}</td>
                    <td data-label="Due Date" class="${dueDateClass}">${formattedDate}</td>
                    <td data-label="Priority">${priorityBadge}</td>
                    <td data-label="Settled"><input type="checkbox" ${expense.settled ? 'checked' : ''} onchange="toggleSettled(${expense.id})"></td>
                    <td data-label="Action">
                        <button class="btn btn-edit" style="padding: 4px 8px; font-size: 11px; margin-right: 3px;" onclick="editExpense(${expense.id})">✏️</button>
                        <button class="btn btn-calendar" style="padding: 4px 8px; font-size: 11px; margin-right: 3px;" onclick="addToCalendar(${expense.id})">📅</button>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="removeExpense(${expense.id})">🗑️</button>
                    </td>
                </tr>
            `;
        }
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;

    document.getElementById('totalAmountDisplay').textContent = `₱${total.toFixed(2)}`;
    document.getElementById('settledAmountDisplay').textContent = `₱${totalSettled.toFixed(2)}`;
    
    tableContent.innerHTML = tableHTML;
}

function autoSaveActiveTable() {
    if (!state.activeTableId) return;
    const idx = state.savedTables.findIndex(t => t.id === state.activeTableId);
    if (idx === -1) {
        state.activeTableId = null;
        return;
    }
    const table = state.savedTables[idx];
    table.expenses = JSON.parse(JSON.stringify(state.expenses));
    table.totalAmount = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    table.savedDate = new Date().toISOString();
    saveDataToLocalStorage(state.savedTables);
    if (state.githubConfig.connected) {
        autoSyncToGitHub(state.githubConfig, state.savedTables);
    }
    updateHistoryView();
}

async function removeExpense(id) {
    if (state.editingExpenseId) {
        showAlert('Please save or cancel the current edit before deleting.', 'warning');
        return;
    }
    const confirmed = await showConfirm('Are you sure you want to delete this expense?', 'Delete Expense');
    if (confirmed) {
        state.expenses = state.expenses.filter(expense => expense.id !== id);
        updateTable();
        autoSaveActiveTable();
    }
}

function editExpense(id) {
    if (state.editingExpenseId && state.editingExpenseId !== id) {
        showAlert('Please save or cancel the current edit before editing another expense.', 'warning');
        return;
    }
    state.editingExpenseId = id;
    updateTable();
}

function saveEdit(id) {
    const biller = document.getElementById(`edit-biller-${id}`).value.trim();
    const description = document.getElementById(`edit-description-${id}`).value.trim();
    const amount = parseFloat(document.getElementById(`edit-amount-${id}`).value);
    const dueDate = document.getElementById(`edit-dueDate-${id}`).value;

    if (!biller || !description || !amount || amount <= 0 || !dueDate) {
        showAlert('Please fill in all fields with valid data.', 'warning');
        return;
    }

    const expenseIndex = state.expenses.findIndex(expense => expense.id === id);
    if (expenseIndex !== -1) {
        state.expenses[expenseIndex] = {
            ...state.expenses[expenseIndex],
            biller: biller,
            description: description,
            amount: amount,
            dueDate: dueDate
        };
    }

    state.editingExpenseId = null;
    updateTable();
    autoSaveActiveTable();
}

function cancelEdit() {
    state.editingExpenseId = null;
    updateTable();
}

function clearTableData() {
    state.expenses = [];
    state.editingExpenseId = null;
    state.activeTableId = null;
    updateTable();
}

function toggleSettled(id) {
    const expense = state.expenses.find(exp => exp.id === id);
    if (expense) {
        expense.settled = !expense.settled;
        updateTable();
        autoSaveActiveTable();
    }
}

async function refreshTable() {
    if (state.editingExpenseId) {
        showAlert('Please save or cancel the current edit before refreshing.', 'warning');
        return;
    }
    if (state.expenses.length === 0) {
        return;
    }

    if (state.activeTableId) {
        const saveChanges = await showConfirm('Save changes before refreshing?', 'Refresh Table');
        if (saveChanges) {
            autoSaveActiveTable();
        }
        const confirmed = await showConfirm('Are you sure you want to clear all expenses? This action cannot be undone.', 'Clear All Expenses');
        if (confirmed) {
            clearTableData();
        }
    } else {
        openSaveModal(true);
    }
}

function exportToCSV() {
    if (state.expenses.length === 0) {
        showAlert('No data to export!', 'warning');
        return;
    }

    downloadCSV(state.expenses, `monthly-expenses-${new Date().toISOString().split('T')[0]}.csv`);
}

function printTable() {
    window.print();
}

function addToCalendar(expenseId) {
    const expense = state.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const title = `Pay ${expense.biller} - ${expense.description}`;
    const details = `Amount: ₱${expense.amount.toFixed(2)}\nBiller: ${expense.biller}\nDescription: ${expense.description}`;
    const startDate = new Date(expense.dueDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}&details=${encodeURIComponent(details)}&location=&sf=true&output=xml`;
    
    window.open(googleCalendarUrl, '_blank');
}

async function addAllToCalendar() {
    if (state.expenses.length === 0) {
        showAlert('No expenses to add to calendar!', 'warning');
        return;
    }

    const confirmed = await showConfirm(`Add all ${state.expenses.length} expenses to Google Calendar?`, 'Add to Calendar');
    if (confirmed) {
        state.expenses.forEach((expense, index) => {
            setTimeout(() => {
                addToCalendar(expense.id);
            }, index * 500); // Stagger the calendar opens by 500ms
        });
    }
}

function formatDateForGoogle(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function openSaveModal(forRefresh = false) {
    if (state.expenses.length === 0) {
        showAlert('No expenses to save! Add some expenses first.', 'warning');
        return;
    }
    if (state.editingExpenseId) {
        showAlert('Please save or cancel the current edit before saving the table.', 'warning');
        return;
    }
    refreshAfterSave = forRefresh;
    const proceedBtn = document.getElementById('proceedWithoutSaveBtn');
    proceedBtn.style.display = forRefresh ? 'inline-block' : 'none';
    const titleEl = document.querySelector('#saveModal h2');
    titleEl.textContent = forRefresh ? 'Save Table Before Refresh' : 'Save Current Table';
    document.getElementById('saveModal').style.display = 'block';
}

function closeSaveModal() {
    document.getElementById('saveModal').style.display = 'none';
    document.getElementById('saveForm').reset();
    document.getElementById('proceedWithoutSaveBtn').style.display = 'none';
    refreshAfterSave = false;
}

function saveCurrentTable(name, description) {
    const savedTable = {
        id: Date.now(),
        name: name,
        description: description || '',
        expenses: JSON.parse(JSON.stringify(state.expenses)), // Deep copy
        savedDate: new Date().toISOString(),
        totalAmount: state.expenses.reduce((sum, expense) => sum + expense.amount, 0)
    };

    state.savedTables.push(savedTable);
    saveDataToLocalStorage(state.savedTables); // Save to localStorage first

    // Auto-sync to GitHub if connected
    if (state.githubConfig.connected) {
        autoSyncToGitHub(state.githubConfig, state.savedTables);
    }

    updateHistoryView();
    closeSaveModal();

    // Show success message
    const syncStatus = state.githubConfig.connected ? " and synced to GitHub" : "";
    showAlert(`Table "${name}" saved to History${syncStatus}! (Kept for 150 days)`, 'success');

    if (refreshAfterSave) {
        clearTableData();
    }
}

function updateHistoryView() {
    const historyContent = document.getElementById('historyContent');
    
    if (state.savedTables.length === 0) {
        historyContent.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">📚</div>
                <h3>No saved tables yet</h3>
                <p>Save your current bill table to start building your history</p>
                <p style="font-size: 14px; color: #6c757d; margin-top: 10px;">💾 Tables are automatically saved for 150 days${state.githubConfig.connected ? ' + synced to GitHub' : ''}</p>
            </div>
        `;
        return;
    }
    
    // Sort saved tables by date (newest first)
    const sortedTables = [...state.savedTables].sort((a, b) => new Date(b.savedDate) - new Date(a.savedDate));
    
    const syncStatus = state.githubConfig.connected ? ' + Auto-synced to GitHub ☁️' : ' (Connect GitHub for cloud backup)';
    let historyHTML = `
        <div style="text-align: center; margin-bottom: 20px; padding: 10px; background: #e3f2fd; border-radius: 8px; color: #1976d2;">
            💾 <strong>${state.savedTables.length}</strong> table(s) saved for 150 days${syncStatus}
        </div>
    `;
    
    sortedTables.forEach(table => {
        const savedDate = new Date(table.savedDate);
        const now = new Date();
        const daysAgo = Math.floor((now - savedDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = 150 - daysAgo; // Updated to 150 days
        
        const formattedDate = savedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const overdueBills = table.expenses.filter(expense => {
            const dueDate = new Date(expense.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return dueDate < today;
        }).length;
        
        const highPriorityBills = table.expenses.filter(expense => {
            const dueDate = new Date(expense.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            return daysDiff >= 0 && daysDiff <= 10;
        }).length;
        
        let retentionInfo = '';
        if (daysRemaining <= 10) {
            retentionInfo = `<span style="color: #dc3545; font-weight: 600;">⚠️ Expires in ${daysRemaining} day(s)</span>`;
        } else if (daysRemaining <= 30) {
            retentionInfo = `<span style="color: #ffc107;">📅 ${daysRemaining} days remaining</span>`;
        } else {
            retentionInfo = `<span style="color: #28a745;">✅ ${daysRemaining} days remaining</span>`;
        }
        
        historyHTML += `
            <div class="history-item">
                <div class="history-header">
                    <div class="history-title">${table.name}</div>
                    <div class="history-date">${formattedDate}</div>
                </div>
                ${table.description ? `<p style="color: #6c757d; margin-bottom: 10px;">${table.description}</p>` : ''}
                <div style="margin-bottom: 15px; font-size: 12px;">
                    ${retentionInfo}
                </div>
                <div class="history-summary">
                    <div class="history-stat">📋 <strong>${table.expenses.length}</strong> bills</div>
                    <div class="history-stat">💰 <strong>₱${table.totalAmount.toFixed(2)}</strong> total</div>
                    ${overdueBills > 0 ? `<div class="history-stat" style="background: #f8d7da; color: #721c24;">⚠️ <strong>${overdueBills}</strong> overdue</div>` : ''}
                    ${highPriorityBills > 0 ? `<div class="history-stat" style="background: #fff3cd; color: #856404;">🔥 <strong>${highPriorityBills}</strong> high priority</div>` : ''}
                </div>
                <div class="history-actions">
                    <button class="btn btn-view btn-small" onclick="viewSavedTable(${table.id})">👁️ View</button>
                    <button class="btn btn-restore btn-small" onclick="restoreTable(${table.id})">🔄 Restore</button>
                    <button class="btn btn-export btn-small" onclick="exportSavedTable(${table.id})">📊 Export</button>
                    <button class="btn btn-delete-history btn-small" onclick="deleteSavedTable(${table.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
    });
    
    historyContent.innerHTML = historyHTML;
}

function viewSavedTable(tableId) {
    const table = state.savedTables.find(t => t.id === tableId);
    if (!table) return;
    
    // Create a temporary view modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalSettled = table.expenses.reduce((sum, exp) => exp.settled ? sum + exp.amount : sum, 0);

    let tableHTML = `
        <div class="modal-content" style="max-width: 90%; max-height: 80%; overflow-y: auto;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h2>${table.name}</h2>
            ${table.description ? `<p style="color: #6c757d; margin-bottom: 20px;">${table.description}</p>` : ''}
            <p style="color: #6c757d; margin-bottom: 20px;">Saved on: ${new Date(table.savedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: linear-gradient(45deg, #667eea, #764ba2); color: white;">
                        <th style="padding: 12px; text-align: left;">Biller</th>
                        <th style="padding: 12px; text-align: left;">Description</th>
                        <th style="padding: 12px; text-align: left;">Amount</th>
                        <th style="padding: 12px; text-align: left;">Due Date</th>
                        <th style="padding: 12px; text-align: left;">Priority</th>
                        <th style="padding: 12px; text-align: left;">Settled</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Sort expenses by due date
    const sortedExpenses = [...table.expenses].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    sortedExpenses.forEach(expense => {
        const dueDate = new Date(expense.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let priorityBadge = '';
        let rowStyle = 'padding: 12px; border-bottom: 1px solid #e9ecef;';
        
        if (daysDiff < 0) {
            priorityBadge = '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;">OVERDUE</span>';
            rowStyle += ' background-color: #fff3cd;';
        } else if (daysDiff <= 7) {
            priorityBadge = '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;">HIGH</span>';
            rowStyle += ' background-color: #fff3cd;';
        }
        
        const formattedDate = new Date(expense.dueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        tableHTML += `
            <tr>
                <td data-label="Biller" style="${rowStyle}">${expense.biller}</td>
                <td data-label="Description" style="${rowStyle}">${expense.description}</td>
                <td data-label="Amount" style="${rowStyle} font-weight: 600; color: #dc3545;">₱${expense.amount.toFixed(2)}</td>
                <td data-label="Due Date" style="${rowStyle}">${formattedDate}</td>
                <td data-label="Priority" style="${rowStyle}">${priorityBadge}</td>
                <td data-label="Settled" style="${rowStyle} text-align:center;"><input type="checkbox" ${expense.settled ? 'checked' : ''} disabled></td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
                <tfoot>
                    <tr style="background: linear-gradient(45deg, #28a745, #20c997); color: white; font-weight: 700;">
                        <td colspan="3" style="padding: 12px;"><strong>Total</strong></td>
                        <td colspan="3" style="padding: 12px;"><strong>₱${table.totalAmount.toFixed(2)}</strong></td>
                    </tr>
                    <tr style="background: linear-gradient(45deg, #6c757d, #adb5bd); color: white; font-weight: 700;">
                        <td colspan="3" style="padding: 12px;"><strong>Settled</strong></td>
                        <td colspan="3" style="padding: 12px;"><strong>₱${totalSettled.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    modal.innerHTML = tableHTML;
    document.body.appendChild(modal);
}

async function restoreTable(tableId) {
    if (state.editingExpenseId) {
        showAlert('Please save or cancel the current edit before restoring a table.', 'warning');
        return;
    }

    const table = state.savedTables.find(t => t.id === tableId);
    if (!table) return;

    if (state.expenses.length > 0) {
        const confirmed = await showConfirm('This will replace your current expenses. Continue?', 'Restore Table');
        if (!confirmed) return;
    }

    state.expenses = JSON.parse(JSON.stringify(table.expenses)); // Deep copy
    state.activeTableId = tableId;
    switchTab('current');
    updateTable();
    showAlert(`Table "${table.name}" restored successfully!`, 'success');
}

function exportSavedTable(tableId) {
    const table = state.savedTables.find(t => t.id === tableId);
    if (!table) return;

    downloadCSV(
        table.expenses,
        `${table.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date(table.savedDate).toISOString().split('T')[0]}.csv`,
        7
    );
}

async function deleteSavedTable(tableId) {
    const table = state.savedTables.find(t => t.id === tableId);
    if (!table) return;
    
    const confirmed = await showConfirm(`Are you sure you want to delete "${table.name}"? This action cannot be undone.`, 'Delete Table');
    if (confirmed) {
        state.savedTables = state.savedTables.filter(t => t.id !== tableId);
        if (state.activeTableId === tableId) {
            state.activeTableId = null;
        }
        saveDataToLocalStorage(state.savedTables); // Update localStorage
        
        // Auto-sync deletion to GitHub if connected
        if (state.githubConfig.connected) {
            autoSyncToGitHub(state.githubConfig, state.savedTables);
        }
        
        updateHistoryView();
        showAlert('Table deleted successfully.', 'success');
    }
}

// Initialize the app when page loads
window.addEventListener('load', initializeApp); // State initialized in modules/state.js

// Initialize data on page load
function initializeApp() {
    state.savedTables = loadSavedData(state.savedTables);
    state.githubConfig = loadGitHubConfig();
    updateTable();
    updateHistoryView();
    updateGitHubStatus(state.githubConfig);
    updateGitHubUI(state.githubConfig);

}

document.addEventListener('DOMContentLoaded', function() {
    function updateHeaderHeight() {
        const header = document.querySelector('header');
        if (header) {
            document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
        }
    }
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    document.getElementById('saveForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const tableName = document.getElementById('tableName').value.trim();
        const tableDescription = document.getElementById('tableDescription').value.trim();
        if (tableName) {
            saveCurrentTable(tableName, tableDescription);
        } else {
            showAlert('Please enter a table name.', 'warning');
        }
    });

    document.getElementById('expenseForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const biller = document.getElementById('biller').value.trim();
        const description = document.getElementById('description').value.trim();
        const amount = document.getElementById('amount').value;
        const dueDate = document.getElementById('dueDate').value;
        if (biller && description && amount && dueDate && parseFloat(amount) > 0) {
            addExpense(biller, description, amount, dueDate);
            refreshForm();
            showToast('Expense added to table!', 'success');
        } else {
            showAlert('Please fill in all fields with valid data.', 'warning');
        }
    });

    window.onclick = function(event) {
        const expenseModal = document.getElementById('expenseModal');
        const saveModal = document.getElementById('saveModal');
        const alertModal = document.getElementById('alertModal');
        if (event.target === expenseModal) {
            closeModal();
        }
        if (event.target === saveModal) {
            closeSaveModal();
        }
        if (event.target === alertModal) {
            closeAlert();
        }
    };

    document.getElementById('alertCancelBtn').onclick = function() {
        closeAlert(false);
    };
    document.getElementById('alertOkBtn').onclick = function() {
        closeAlert(true);
    };

    document.getElementById('proceedWithoutSaveBtn').onclick = function() {
        closeSaveModal();
        clearTableData();
    };

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (state.editingExpenseId) {
                cancelEdit();
            } else {
                closeModal();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && state.editingExpenseId) {
            saveEdit(state.editingExpenseId);
        }
    });
});

Object.assign(window, {
    switchTab,
    openModal,
    closeModal,
    refreshForm,
    openSaveModal,
    closeSaveModal,
    exportToCSV,
    addAllToCalendar,
    refreshTable,
    printTable,
    connectGitHub: connectGitHubWrapper,
    syncFromGitHub: syncFromGitHubWrapper,
    disconnectGitHub: disconnectGitHubWrapper,
    closeAlert,
    editExpense,
    saveEdit,
    cancelEdit,
    toggleSettled,
    removeExpense,
    addToCalendar,
    viewSavedTable,
    restoreTable,
    exportSavedTable,
    deleteSavedTable
});
