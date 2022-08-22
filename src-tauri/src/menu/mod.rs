use tauri::{CustomMenuItem, Event, Menu, Submenu, WindowMenuEvent, Wry};
use crate::Payload;

pub fn build_menu() -> Menu {
    let about = CustomMenuItem::new("about".to_string(), "About");
    let submenu = Submenu::new("File", Menu::new().add_item(about));
    let menu = Menu::new()
        .add_submenu(submenu);
    menu
}

pub fn handle_menu_click(event: WindowMenuEvent<Wry>) {
    match event.menu_item_id() {
        "about" => {
            let window = event.window();
            window.emit("main::showabout", Payload { message: "".to_string() }).unwrap();
        }
        _ => {}
    }
}