import { showAlert, closeAlert, showConfirm } from "./modules/alert.js";
import { loadSavedData, saveDataToLocalStorage, loadGitHubConfig, saveGitHubConfig } from "./modules/storage.js";
import { updateGitHubStatus, updateGitHubUI, logSync, connectGitHub, syncFromGitHub, autoSyncToGitHub, disconnectGitHub } from "./modules/github.js";



async function connectGitHubWrapper() {
    githubConfig = await connectGitHub(githubConfig);
}

async function syncFromGitHubWrapper() {
    savedTables = await syncFromGitHub(githubConfig, savedTables);
    updateHistoryView();
}

async function disconnectGitHubWrapper() {
    githubConfig = await disconnectGitHub(githubConfig);
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
    
    currentTab = tabName;
    
    if (tabName === 'history') {
        updateHistoryView();
    } else if (tabName === 'sync') {
        updateGitHubStatus(githubConfig);
    }
}

function openModal() {
    if (editingExpenseId) {
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
        dueDate: dueDate
    };
    expenses.push(expense);
    updateTable();
}

function updateTable() {
    const tableContent = document.getElementById('tableContent');
    
    if (expenses.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>No expenses added yet</h3>
                <p>Click "Add New Expense" to get started</p>
            </div>
        `;
        return;
    }

    // Sort expenses by due date (earliest first)
    const sortedExpenses = [...expenses].sort((a, b) => {
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
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
        
        const isEditing = editingExpenseId === expense.id;
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
            <tfoot>
                <tr class="total-row">
                    <td colspan="3"><strong>Total Monthly Expenses</strong></td>
                    <td colspan="3"><strong>₱${total.toFixed(2)}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;
    
    tableContent.innerHTML = tableHTML;
}

async function removeExpense(id) {
    if (editingExpenseId) {
        showAlert('Please save or cancel the current edit before deleting.', 'warning');
        return;
    }
    const confirmed = await showConfirm('Are you sure you want to delete this expense?', 'Delete Expense');
    if (confirmed) {
        expenses = expenses.filter(expense => expense.id !== id);
        updateTable();
    }
}

function editExpense(id) {
    if (editingExpenseId && editingExpenseId !== id) {
        showAlert('Please save or cancel the current edit before editing another expense.', 'warning');
        return;
    }
    editingExpenseId = id;
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

    const expenseIndex = expenses.findIndex(expense => expense.id === id);
    if (expenseIndex !== -1) {
        expenses[expenseIndex] = {
            ...expenses[expenseIndex],
            biller: biller,
            description: description,
            amount: amount,
            dueDate: dueDate
        };
    }

    editingExpenseId = null;
    updateTable();
}

function cancelEdit() {
    editingExpenseId = null;
    updateTable();
}

async function refreshTable() {
    if (editingExpenseId) {
        showAlert('Please save or cancel the current edit before refreshing.', 'warning');
        return;
    }
    const confirmed = await showConfirm('Are you sure you want to clear all expenses? This action cannot be undone.', 'Clear All Expenses');
    if (confirmed) {
        expenses = [];
        editingExpenseId = null;
        updateTable();
    }
}

function exportToCSV() {
    if (expenses.length === 0) {
        showAlert('No data to export!', 'warning');
        return;
    }

    // Sort expenses by due date for export too
    const sortedExpenses = [...expenses].sort((a, b) => {
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    let csvContent = "Biller,Description,Amount,Due Date,Priority\n";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    sortedExpenses.forEach(expense => {
        const dueDate = new Date(expense.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let priority = 'Normal';
        if (daysDiff < 0) {
            priority = 'OVERDUE';
        } else if (daysDiff <= 10) {
            priority = 'HIGH';
        }
        
        csvContent += `"${expense.biller}","${expense.description}",${expense.amount},"${expense.dueDate}","${priority}"\n`;
    });
    
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    csvContent += `"","Total",${total},"",""`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-expenses-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function printTable() {
    window.print();
}

function addToCalendar(expenseId) {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const title = `Pay ${expense.biller} - ${expense.description}`;
    const details = `Amount: ₱${expense.amount.toFixed(2)}\nBiller: ${expense.biller}\nDescription: ${expense.description}`;
    const startDate = new Date(expense.dueDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}&details=${encodeURIComponent(details)}&location=&sf=true&output=xml`;
    
    window.open(googleCalendarUrl, '_blank');
}

async function addAllToCalendar() {
    if (expenses.length === 0) {
        showAlert('No expenses to add to calendar!', 'warning');
        return;
    }

    const confirmed = await showConfirm(`Add all ${expenses.length} expenses to Google Calendar?`, 'Add to Calendar');
    if (confirmed) {
        expenses.forEach((expense, index) => {
            setTimeout(() => {
                addToCalendar(expense.id);
            }, index * 500); // Stagger the calendar opens by 500ms
        });
    }
}

function formatDateForGoogle(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function openSaveModal() {
    if (expenses.length === 0) {
        showAlert('No expenses to save! Add some expenses first.', 'warning');
        return;
    }
    if (editingExpenseId) {
        showAlert('Please save or cancel the current edit before saving the table.', 'warning');
        return;
    }
    document.getElementById('saveModal').style.display = 'block';
}

function closeSaveModal() {
    document.getElementById('saveModal').style.display = 'none';
    document.getElementById('saveForm').reset();
}

function saveCurrentTable(name, description) {
    const savedTable = {
        id: Date.now(),
        name: name,
        description: description || '',
        expenses: JSON.parse(JSON.stringify(expenses)), // Deep copy
        savedDate: new Date().toISOString(),
        totalAmount: expenses.reduce((sum, expense) => sum + expense.amount, 0)
    };
    
    savedTables.push(savedTable);
    saveDataToLocalStorage(savedTables); // Save to localStorage first
    
    // Auto-sync to GitHub if connected
    if (githubConfig.connected) {
        autoSyncToGitHub(githubConfig, savedTables);
    }
    
    updateHistoryView();
    closeSaveModal();
    
    // Show success message
    const syncStatus = githubConfig.connected ? " and synced to GitHub" : "";
    showAlert(`Table "${name}" saved to History${syncStatus}! (Kept for 150 days)`, 'success');
}

function updateHistoryView() {
    const historyContent = document.getElementById('historyContent');
    
    if (savedTables.length === 0) {
        historyContent.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">📚</div>
                <h3>No saved tables yet</h3>
                <p>Save your current bill table to start building your history</p>
                <p style="font-size: 14px; color: #6c757d; margin-top: 10px;">💾 Tables are automatically saved for 150 days${githubConfig.connected ? ' + synced to GitHub' : ''}</p>
            </div>
        `;
        return;
    }
    
    // Sort saved tables by date (newest first)
    const sortedTables = [...savedTables].sort((a, b) => new Date(b.savedDate) - new Date(a.savedDate));
    
    const syncStatus = githubConfig.connected ? ' + Auto-synced to GitHub ☁️' : ' (Connect GitHub for cloud backup)';
    let historyHTML = `
        <div style="text-align: center; margin-bottom: 20px; padding: 10px; background: #e3f2fd; border-radius: 8px; color: #1976d2;">
            💾 <strong>${savedTables.length}</strong> table(s) saved for 150 days${syncStatus}
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
    const table = savedTables.find(t => t.id === tableId);
    if (!table) return;
    
    // Create a temporary view modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
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
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
                <tfoot>
                    <tr style="background: linear-gradient(45deg, #28a745, #20c997); color: white; font-weight: 700;">
                        <td colspan="2" style="padding: 12px;"><strong>Total</strong></td>
                        <td colspan="3" style="padding: 12px;"><strong>₱${table.totalAmount.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    modal.innerHTML = tableHTML;
    document.body.appendChild(modal);
}

async function restoreTable(tableId) {
    if (editingExpenseId) {
        showAlert('Please save or cancel the current edit before restoring a table.', 'warning');
        return;
    }
    
    const table = savedTables.find(t => t.id === tableId);
    if (!table) return;
    
    if (expenses.length > 0) {
        const confirmed = await showConfirm('This will replace your current expenses. Continue?', 'Restore Table');
        if (!confirmed) return;
    }
    
    expenses = JSON.parse(JSON.stringify(table.expenses)); // Deep copy
    switchTab('current');
    updateTable();
    showAlert(`Table "${table.name}" restored successfully!`, 'success');
}

function exportSavedTable(tableId) {
    const table = savedTables.find(t => t.id === tableId);
    if (!table) return;
    
    const sortedExpenses = [...table.expenses].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let csvContent = "Biller,Description,Amount,Due Date,Priority\n";
    
    sortedExpenses.forEach(expense => {
        const dueDate = new Date(expense.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        
        let priority = 'Normal';
        if (daysDiff < 0) {
            priority = 'OVERDUE';
        } else if (daysDiff <= 7) {
            priority = 'HIGH';
        }
        
        csvContent += `"${expense.biller}","${expense.description}",${expense.amount},"${expense.dueDate}","${priority}"\n`;
    });
    
    csvContent += `"","Total",${table.totalAmount},"",""`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date(table.savedDate).toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

async function deleteSavedTable(tableId) {
    const table = savedTables.find(t => t.id === tableId);
    if (!table) return;
    
    const confirmed = await showConfirm(`Are you sure you want to delete "${table.name}"? This action cannot be undone.`, 'Delete Table');
    if (confirmed) {
        savedTables = savedTables.filter(t => t.id !== tableId);
        saveDataToLocalStorage(savedTables); // Update localStorage
        
        // Auto-sync deletion to GitHub if connected
        if (githubConfig.connected) {
            autoSyncToGitHub(githubConfig, savedTables);
        }
        
        updateHistoryView();
        showAlert('Table deleted successfully.', 'success');
    }
}

// Initialize the app when page loads
window.addEventListener('load', initializeApp);// Global variables
let expenses = [];
let editingExpenseId = null;
let savedTables = [];
let currentTab = 'current';
let githubConfig = {
    token: '',
    repo: '',
    owner: '',
    connected: false
};

// Initialize data on page load
function initializeApp() {
    savedTables = loadSavedData(savedTables);
    githubConfig = loadGitHubConfig();
    updateTable();
    updateHistoryView();
    updateGitHubStatus(githubConfig);
    updateGitHubUI(githubConfig);

}

document.addEventListener('DOMContentLoaded', function() {
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
            closeModal();
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

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (editingExpenseId) {
                cancelEdit();
            } else {
                closeModal();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && editingExpenseId) {
            saveEdit(editingExpenseId);
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
    removeExpense,
    addToCalendar,
    viewSavedTable,
    restoreTable,
    exportSavedTable,
    deleteSavedTable
});
