//menu.rs
use crate::AuthMenuState;

use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager,
};

pub fn build_menu(
    app: &AppHandle<tauri::Wry>,
    is_signed_in: bool,
) -> tauri::Result<Menu<tauri::Wry>> {
    // ── About ──────────────────────────────────────────────────────────────

    let about = PredefinedMenuItem::about(
        app,
        Some("About"),
        Some(AboutMetadata {
            name: Some("Majik Buwiz".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            copyright: Some("© 2026 Majikah Solutions OPC. All rights reserved.".into()),
            website: Some("https://buwiz.majikah.solutions".into()),
            icon: Some(app.default_window_icon().unwrap().clone()),
            license: Some("Apache 2.0".into()),
            authors: Some(vec!["Zelijah".into()]),
            ..Default::default()
        }),
    )?;

    // ── File ────────────────────────────────────────────────────────────

    // Import Invoice submenu
    let import_invoice_mjki =
        MenuItem::with_id(app, "import-invoice-mjki", "from MJKI", true, None::<&str>)?;
    let import_invoice_backup = MenuItem::with_id(
        app,
        "import-invoice-backup",
        "from Backup",
        true,
        None::<&str>,
    )?;
    let import_invoice_submenu = Submenu::with_items(
        app,
        "Invoice",
        true,
        &[&import_invoice_mjki, &import_invoice_backup],
    )?;

    // Import Invoice submenu
    let import_contact_card = MenuItem::with_id(
        app,
        "import-contact",
        "from Contact Card",
        true,
        None::<&str>,
    )?;
    let import_contact_backup = MenuItem::with_id(
        app,
        "import-contact-backup",
        "from Backup",
        true,
        None::<&str>,
    )?;
    let import_contact_submenu = Submenu::with_items(
        app,
        "Contact",
        true,
        &[&import_contact_card, &import_contact_backup],
    )?;
    let import_app_data =
        MenuItem::with_id(app, "import-app-data", "App Data", true, None::<&str>)?;

    let import_expense_mjki =
        MenuItem::with_id(app, "import-expense-mjki", "from MJKI", true, None::<&str>)?;

    let import_expense_backup = MenuItem::with_id(
        app,
        "import-expense-backup",
        "from Backup",
        true,
        None::<&str>,
    )?;
    let import_expense_submenu = Submenu::with_items(
        app,
        "Expense",
        true,
        &[&import_expense_mjki, &import_expense_backup],
    )?;

    let import_file_submenu = Submenu::with_items(
        app,
        "Import",
        true,
        &[
            &import_contact_submenu,
            &import_invoice_submenu,
            &import_expense_submenu,
            &import_app_data,
        ],
    )?;

    // Export submenu
    let export_contacts =
        MenuItem::with_id(app, "export-contacts", "Contacts", true, None::<&str>)?;
    let export_invoices_backup =
        MenuItem::with_id(app, "export-invoices-backup", "Backup", true, None::<&str>)?;
    let export_invoices_csv =
        MenuItem::with_id(app, "export-invoices-csv", "CSV", true, None::<&str>)?;
    let export_invoices_submenu = Submenu::with_items(
        app,
        "Invoices",
        true,
        &[&export_invoices_backup, &export_invoices_csv],
    )?;

    let export_expenses_backup =
        MenuItem::with_id(app, "export-expenses-backup", "Backup", true, None::<&str>)?;
    let export_expenses_csv =
        MenuItem::with_id(app, "export-expenses-csv", "CSV", true, None::<&str>)?;
    let export_expenses_submenu = Submenu::with_items(
        app,
        "Expenses",
        true,
        &[&export_expenses_backup, &export_expenses_csv],
    )?;

    let export_app_data =
        MenuItem::with_id(app, "export-app-data", "App Data", true, None::<&str>)?;
    let export_submenu = Submenu::with_items(
        app,
        "Export",
        true,
        &[
            &export_contacts,
            &export_invoices_submenu,
            &export_expenses_submenu,
            &export_app_data,
        ],
    )?;

    let file_menu =
        Submenu::with_items(app, "File", true, &[&import_file_submenu, &export_submenu])?;

    // ── Account ────────────────────────────────────────────────────────────
    let switch_account =
        MenuItem::with_id(app, "switch-account", "Switch Account", true, None::<&str>)?;
    let import_contact =
        MenuItem::with_id(app, "import-contact", "Import Contact", true, None::<&str>)?;
    let refresh_muid = MenuItem::with_id(
        app,
        "refresh-muid",
        "Refresh MUID",
        is_signed_in,
        None::<&str>,
    )?;
    let verify_muid = MenuItem::with_id(app, "verify-muid", "Verify MUID", true, None::<&str>)?;
    let minimize_to_tray = MenuItem::with_id(
        app,
        "minimize-to-tray",
        "Minimize to Tray",
        true,
        None::<&str>,
    )?;
    let sign_in = MenuItem::with_id(app, "sign-in", "Sign In", !is_signed_in, None::<&str>)?;
    let sign_out = MenuItem::with_id(app, "sign-out", "Sign Out", is_signed_in, None::<&str>)?;

    let auth_state = app.state::<AuthMenuState>();
    *auth_state.sign_in.lock().unwrap() = Some(sign_in.clone());
    *auth_state.sign_out.lock().unwrap() = Some(sign_out.clone());
    *auth_state.refresh_muid.lock().unwrap() = Some(refresh_muid.clone());

    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;

    let account_menu = Submenu::with_items(
        app,
        "Account",
        true,
        &[
            &switch_account,
            &import_contact,
            &PredefinedMenuItem::separator(app)?,
            &refresh_muid,
            &verify_muid,
            &PredefinedMenuItem::separator(app)?,
            &minimize_to_tray,
            &PredefinedMenuItem::separator(app)?,
            &sign_in,
            &sign_out,
            &PredefinedMenuItem::separator(app)?,
            &exit,
        ],
    )?;

    // ── Invoices ────────────────────────────────────────────────────────
    let manage_invoices = MenuItem::with_id(
        app,
        "manage-invoices",
        "Manage Invoices",
        true,
        None::<&str>,
    )?;

    let dashboard_summary = MenuItem::with_id(
        app,
        "dashboard-summary",
        "Dashboard Summary",
        true,
        None::<&str>,
    )?;

    let invoice_settings =
        MenuItem::with_id(app, "invoice-settings", "Settings", true, None::<&str>)?;

    // let generate_summary = MenuItem::with_id(
    //     app,
    //     "generate-summary",
    //     "Generate Summary",
    //     true,
    //     None::<&str>,
    // )?;

    let invoices_menu = Submenu::with_items(
        app,
        "Invoices",
        true,
        &[
            &manage_invoices,
            &dashboard_summary,
            &PredefinedMenuItem::separator(app)?,
            &invoice_settings,
            &PredefinedMenuItem::separator(app)?,
            &export_invoices_submenu, // &PredefinedMenuItem::separator(app)?,
                                      // &generate_summary,
        ],
    )?;

    // ── Expenses ────────────────────────────────────────────────────────
    let manage_expenses = MenuItem::with_id(
        app,
        "manage-expenses",
        "Manage Expenses",
        true,
        None::<&str>,
    )?;

    let expenses_menu = Submenu::with_items(
        app,
        "Expenses",
        true,
        &[
            &manage_expenses,
            &PredefinedMenuItem::separator(app)?,
            &import_expense_submenu,
        ],
    )?;
    // ── Preferences ────────────────────────────────────────────────────────
    let toggle_dark_mode = MenuItem::with_id(
        app,
        "toggle-dark-mode",
        "Toggle Dark Mode",
        true,
        None::<&str>,
    )?;

    let user_preferences = MenuItem::with_id(
        app,
        "user-preferences",
        "User Preferences",
        true,
        None::<&str>,
    )?;

    let tax_profile_wizard = MenuItem::with_id(
        app,
        "tax-profile-wizard",
        "Tax Profile Wizard",
        true,
        None::<&str>,
    )?;

    let preferences_menu = Submenu::with_items(
        app,
        "Preferences",
        true,
        &[
            &toggle_dark_mode,
            &PredefinedMenuItem::separator(app)?,
            &user_preferences,
            &PredefinedMenuItem::separator(app)?,
            &tax_profile_wizard,
        ],
    )?;

    // ── Tools ──────────────────────────────────────────────────────────────
    let export_majik_key = MenuItem::with_id(
        app,
        "export-majik-key",
        "Export Majik Key",
        true,
        None::<&str>,
    )?;
    let validate_invoice = MenuItem::with_id(
        app,
        "validate-invoice",
        "Validate Invoice",
        true,
        None::<&str>,
    )?;
    let launch_web_app =
        MenuItem::with_id(app, "launch-web-app", "Launch Web App", true, None::<&str>)?;
    let system_status =
        MenuItem::with_id(app, "system-status", "System Status", true, None::<&str>)?;

    let tools_menu = Submenu::with_items(
        app,
        "Tools",
        true,
        &[
            &export_majik_key,
            &validate_invoice,
            &PredefinedMenuItem::separator(app)?,
            &launch_web_app,
            &PredefinedMenuItem::separator(app)?,
            &system_status,
        ],
    )?;

    // ── Help ───────────────────────────────────────────────────────────────
    let docs = MenuItem::with_id(app, "docs", "Docs", true, None::<&str>)?;
    let start_tutorial = MenuItem::with_id(app, "tutorial", "Start Tutorial", true, None::<&str>)?;
    let product_info = MenuItem::with_id(
        app,
        "product-info",
        "Product Information",
        true,
        None::<&str>,
    )?;
    let developer = MenuItem::with_id(app, "developer", "Developer", true, None::<&str>)?;
    let report_issue =
        MenuItem::with_id(app, "report-issue", "Report an Issue", true, None::<&str>)?;
    let submit_ticket =
        MenuItem::with_id(app, "submit-ticket", "Submit Ticket", true, None::<&str>)?;

    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &docs,
            &start_tutorial,
            &product_info,
            &developer,
            &PredefinedMenuItem::separator(app)?,
            &report_issue,
            &submit_ticket,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            &file_menu,
            &account_menu,
            &invoices_menu,
            &expenses_menu,
            &preferences_menu,
            &tools_menu,
            &help_menu,
            &about,
        ],
    )
}

pub fn handle_menu_event(app: &AppHandle<tauri::Wry>, event_id: &str) {
    match event_id {
        // ── File ─────────────────────────────────────────────────────────
        "import-invoice-mjki" => {
            let _ = app.emit("trigger-import-invoice-mjki", ());
        }
        "import-invoice-backup" => {
            let _ = app.emit("trigger-import-invoice-backup", ());
        }
        "import-app-data" => {
            let _ = app.emit("trigger-import-app-data", ());
        }

        "import-expense-mjki" => {
            let _ = app.emit("trigger-import-expense-mjki", ());
        }

        "import-expense-backup" => {
            let _ = app.emit("trigger-import-expense-backup", ());
        }

        "export-contacts" => {
            let _ = app.emit("trigger-export-contacts", ());
        }
        "export-invoices-backup" => {
            let _ = app.emit("trigger-export-invoices-backup", ());
        }
        "export-invoices-csv" => {
            let _ = app.emit("trigger-export-invoices-csv", ());
        }

        "export-expenses-backup" => {
            let _ = app.emit("trigger-export-expenses-backup", ());
        }
        "export-expenses-csv" => {
            let _ = app.emit("trigger-export-expenses-csv", ());
        }
        "export-app-data" => {
            let _ = app.emit("trigger-export-app-data", ());
        }

        // ── Account ─────────────────────────────────────────────────────────
        "switch-account" => {
            let _ = app.emit("trigger-switch-account", ());
        }
        "import-contact" => {
            let _ = app.emit("trigger-import-contact", ());
        }

        "import-contact-backup" => {
            let _ = app.emit("trigger-import-contact-backup", ());
        }
        "refresh-muid" => {
            let _ = app.emit("trigger-refresh-muid", ());
        }
        "verify-muid" => {
            let _ = app.emit("trigger-verify-muid", ());
        }
        "minimize-to-tray" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.hide();
            }
        }
        "sign-in" => {
            let _ = app.emit("trigger-auth-sign-in", ());
        }
        "sign-out" => {
            let _ = app.emit("trigger-auth-sign-out", ());
        }
        "exit" => {
            app.exit(0);
        }

        // ── Invoices ──────────────────────────────────────────────────────
        "manage-invoices" => {
            let _ = app.emit("trigger-manage-invoices", ());
        }

        "dashboard-summary" => {
            let _ = app.emit("trigger-dashboard-summary", ());
        }

        "invoice-settings" => {
            let _ = app.emit("trigger-invoice-settings", ());
        }

        // ── Expenses ──────────────────────────────────────────────────────
        "manage-expenses" => {
            let _ = app.emit("trigger-manage-expenses", ());
        }

        // ── Preferences ──────────────────────────────────────────────────────
        "toggle-dark-mode" => {
            let _ = app.emit("trigger-toggle-dark-mode", ());
        }

        "user-preferences" => {
            let _ = app.emit("trigger-user-preferences", ());
        }

        "tax-profile-wizard" => {
            let _ = app.emit("trigger-tax-profile-wizard", ());
        }

        // ── Tools ────────────────────────────────────────────────────────────
        "export-majik-key" => {
            let _ = app.emit("trigger-export-majik-key", ());
        }
        "validate-invoice" => {
            let _ = app.emit("trigger-validate-invoice", ());
        }
        "launch-web-app" => {
            open_url(app, "https://buwiz.majikah.solutions/");
        }
        "system-status" => {
            open_url(app, "https://stats.uptimerobot.com/AeguJiJOrR/");
        }

        // ── Help ─────────────────────────────────────────────────────────────
        "docs" => {
            open_url(app, "https://majikah.solutions/products/majik-buwiz/docs");
        }
        "tutorial" => {
            let _ = app.emit("trigger-start-tutorial", ());
        }
        "product-info" => {
            open_url(app, "https://majikah.solutions/products/majik-buwiz");
        }
        "developer" => {
            open_url(app, "https://thezelijah.world/about");
        }
        "report-issue" => {
            open_url(app, "https://github.com/Majikah/majik-buwiz/issues");
        }
        "submit-ticket" => {
            open_url(app, "https://majikah.solutions/support/tickets");
        }

        _ => {}
    }
}

fn open_url(app: &AppHandle<tauri::Wry>, url: &str) {
    use tauri_plugin_opener::OpenerExt;
    let _ = app.opener().open_url(url, None::<&str>);
}
