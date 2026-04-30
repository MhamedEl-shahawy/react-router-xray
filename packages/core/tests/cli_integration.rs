#![cfg(feature = "cli")]

use assert_cmd::Command;
use predicates::str::contains;
use std::fs;
use tempfile::tempdir;

fn write_router_file(root: &std::path::Path) {
    let src = root.join("src");
    fs::create_dir_all(&src).expect("create src");
    fs::write(
        src.join("router.tsx"),
        r#"
          import { createBrowserRouter } from "react-router-dom";
          export const router = createBrowserRouter([
            { path: "/", element: <Home />, loader: homeLoader, errorElement: <Err /> },
            { path: "/users/:id", element: <User /> }
          ]);
        "#,
    )
    .expect("write router");
}

#[test]
fn analyze_json_outputs_report() {
    let dir = tempdir().expect("tempdir");
    write_router_file(dir.path());

    Command::cargo_bin("xray")
        .expect("xray bin")
        .current_dir(dir.path())
        .args(["analyze", "--format", "json"])
        .assert()
        .success()
        .stdout(contains("\"route_count\""));
}

#[test]
fn routes_list_prints_paths() {
    let dir = tempdir().expect("tempdir");
    write_router_file(dir.path());

    Command::cargo_bin("xray")
        .expect("xray bin")
        .current_dir(dir.path())
        .args(["routes", "--format", "list"])
        .assert()
        .success()
        .stdout(contains("/users/:id"));
}

#[test]
fn report_writes_html_file() {
    let dir = tempdir().expect("tempdir");
    write_router_file(dir.path());
    let out = dir.path().join("out.html");

    Command::cargo_bin("xray")
        .expect("xray bin")
        .current_dir(dir.path())
        .args(["report", "--output", out.to_str().expect("path string")])
        .assert()
        .success();

    let html = fs::read_to_string(out).expect("read html output");
    assert!(html.contains("<!doctype html>"));
}
