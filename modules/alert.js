export let alertCallback = null;

export function showAlert(message, type = 'info', title = null, showCancel = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('alertModal');
        const icon = document.getElementById('alertIcon');
        const titleEl = document.getElementById('alertTitle');
        const messageEl = document.getElementById('alertMessage');
        const okBtn = document.getElementById('alertOkBtn');
        const cancelBtn = document.getElementById('alertCancelBtn');

        const config = {
            success: { icon: '✅', title: title || 'Success', class: 'alert-success' },
            error: { icon: '❌', title: title || 'Error', class: 'alert-error' },
            warning: { icon: '⚠️', title: title || 'Warning', class: 'alert-warning' },
            info: { icon: 'ℹ️', title: title || 'Information', class: 'alert-info' },
            confirm: { icon: '❓', title: title || 'Confirm', class: 'alert-warning' }
        };

        const typeConfig = config[type] || config.info;
        icon.textContent = typeConfig.icon;
        icon.className = `alert-icon ${typeConfig.class}`;
        titleEl.textContent = typeConfig.title;
        messageEl.textContent = message;

        if (showCancel) {
            cancelBtn.style.display = 'block';
            okBtn.textContent = 'OK';
        } else {
            cancelBtn.style.display = 'none';
            okBtn.textContent = 'OK';
        }

        alertCallback = resolve;
        modal.style.display = 'block';
    });
}

export function closeAlert(result = false) {
    document.getElementById('alertModal').style.display = 'none';
    if (alertCallback) {
        alertCallback(result);
        alertCallback = null;
    }
}

export async function showConfirm(message, title = 'Confirm') {
    return await showAlert(message, 'confirm', title, true);
}

export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
    }, duration - 300);

    setTimeout(() => {
        toast.remove();
    }, duration);
}
