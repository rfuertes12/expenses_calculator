# Monthly Expenses Tracker

This simple web app lets you track monthly bills and save them for future reference.

## Features
- Add, edit and remove expenses
- Save tables to history
- Export to CSV or print
- Sync history to GitHub for cloud backup
- Add reminders to Google Calendar

## Setup
1. Open `index.html` in any modern browser.
2. (Optional) Generate a **personal access token** with `repo` scope from your GitHub account.
3. In the **Cloud Sync** tab, enter the token and repository name where data should be stored.

All data is saved locally in your browser. If GitHub sync is connected, tables are automatically uploaded whenever you save or delete them. GitHub tokens are stored only in your local storage and are never shared with third parties.

## Usage Example
1. Add expenses in the main table and click **Save to History**.
2. View previous tables under the **History** tab.
3. Use **Export CSV** or **Print** to keep offline copies.
4. Open the **Cloud Sync** tab to connect or disconnect from GitHub.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to propose changes.

## Security
If you find a security issue, please follow the steps in [SECURITY.md](SECURITY.md).

## License
This project is licensed under the [MIT License](LICENSE).
