fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    let obj_path = std::path::Path::new(&manifest_dir)
        .parent()
        .map(|p| p.join("winsdk").join("lib_x64").join("app_manifest.obj"))
        .unwrap_or_else(|| std::path::PathBuf::from("winsdk\\lib_x64\\app_manifest.obj"));
    if obj_path.exists() {
        println!("cargo:rustc-link-arg-bin=deskit={}", obj_path.display());
    }
    tauri_build::build()
}
