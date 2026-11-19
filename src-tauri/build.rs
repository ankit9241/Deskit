fn main() {
    println!("cargo:rustc-link-arg-bin=pinned=C:\\Users\\ankit\\Desktop\\pinned\\winsdk\\lib_x64\\app_manifest.obj");
    tauri_build::build()
}
