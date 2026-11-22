use log;

#[cfg(target_os = "windows")]
pub fn send_windows_toast(title: &str, body: &str, is_alarm: bool) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};

    let escape_xml = |s: &str| -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    };

    let title_escaped = escape_xml(title);
    let body_escaped = escape_xml(body);

    let toast_xml = if is_alarm {
        format!(
            "<toast scenario=\"alarm\"><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual><audio src=\"ms-winsoundevent:Notification.Looping.Alarm\" loop=\"true\"/></toast>",
            title_escaped, body_escaped
        )
    } else {
        format!(
            "<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>",
            title_escaped, body_escaped
        )
    };

    let doc = XmlDocument::new().map_err(|e| format!("Failed to create XmlDocument: {e}"))?;
    doc.LoadXml(&HSTRING::from(toast_xml.as_str()))
        .map_err(|e| format!("Failed to load toast XML: {e}"))?;

    let toast = ToastNotification::CreateToastNotification(&doc)
        .map_err(|e| format!("Failed to create ToastNotification: {e}"))?;

    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from("DESKIT"))
        .or_else(|_| ToastNotificationManager::CreateToastNotifier())
        .map_err(|e| format!("Failed to create ToastNotifier: {e}"))?;

    notifier
        .Show(&toast)
        .map_err(|e| format!("Failed to show toast notification: {e}"))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn send_windows_toast(_title: &str, _body: &str, _is_alarm: bool) -> Result<(), String> {
    Ok(())
}

pub fn send_desktop_notification(title: &str, body: &str) -> Result<(), String> {
    send_notification_internal(title, body, false)
}

pub fn send_alarm_notification(title: &str, body: &str) -> Result<(), String> {
    send_notification_internal(title, body, true)
}

fn send_notification_internal(title: &str, body: &str, is_alarm: bool) -> Result<(), String> {
    log::info!("Triggering desktop notification (alarm={}): [{}] {}", is_alarm, title, body);

    #[cfg(target_os = "windows")]
    {
        if let Err(e) = send_windows_toast(title, body, is_alarm) {
            log::warn!("WinRT ToastNotificationManager failed ({e}), attempting PowerShell toast fallback...");
            let clean_title = title.replace('"', "'");
            let clean_body = body.replace('"', "'");
            let script = if is_alarm {
                format!(
                    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; \
                     $xml = [Windows.Data.Xml.Dom.XmlDocument]::new(); \
                     $xml.LoadXml([string]\"<toast scenario='alarm'><visual><binding template='ToastGeneric'><text>{}</text><text>{}</text></binding></visual><audio src='ms-winsoundevent:Notification.Looping.Alarm' loop='true'/></toast>\"); \
                     $toast = [Windows.UI.Notifications.ToastNotification]::new($xml); \
                     [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('DESKIT').Show($toast)",
                    clean_title, clean_body
                )
            } else {
                format!(
                    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; \
                     $xml = [Windows.Data.Xml.Dom.XmlDocument]::new(); \
                     $xml.LoadXml([string]\"<toast><visual><binding template='ToastGeneric'><text>{}</text><text>{}</text></binding></visual></toast>\"); \
                     $toast = [Windows.UI.Notifications.ToastNotification]::new($xml); \
                     [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('DESKIT').Show($toast)",
                    clean_title, clean_body
                )
            };

            let res = std::process::Command::new("powershell")
                .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
                .output();

            if let Err(cmd_err) = res {
                log::error!("PowerShell toast notification fallback failed: {cmd_err}");
                return Err(format!("Toast error: {e}, fallback error: {cmd_err}"));
            }
        }
    }

    Ok(())
}
