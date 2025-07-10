export function downloadCSV(expenses, filename, highPriorityDays = 10) {
    if (!expenses || expenses.length === 0) {
        return;
    }

    const sorted = [...expenses].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let csvContent = 'Biller,Description,Amount,Due Date,Priority\n';

    sorted.forEach(exp => {
        const dueDate = new Date(exp.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        let priority = 'Normal';
        if (daysDiff < 0) {
            priority = 'OVERDUE';
        } else if (daysDiff <= highPriorityDays) {
            priority = 'HIGH';
        }

        csvContent += `"${exp.biller}","${exp.description}",${exp.amount},"${exp.dueDate}","${priority}"\n`;
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    csvContent += `"","Total",${total},"",""`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
