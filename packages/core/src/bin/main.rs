#[cfg(feature = "cli")]
use clap::{Parser, Subcommand, ValueEnum};
#[cfg(feature = "cli")]
use colored::Colorize;
#[cfg(feature = "cli")]
use react_router_xray_core::analyzer::{analyze_tree, AnalysisReport, RouteIssue};
#[cfg(feature = "cli")]
use react_router_xray_core::parser::{parse_source, ParsedRouteTree};
#[cfg(feature = "cli")]
use react_router_xray_core::report::{generate_html_report, HtmlReportOptions};
#[cfg(feature = "cli")]
use std::fs;
#[cfg(feature = "cli")]
use std::path::{Path, PathBuf};
#[cfg(feature = "cli")]
use std::thread;
#[cfg(feature = "cli")]
use std::time::{Duration, SystemTime};
#[cfg(feature = "cli")]
use tabled::{Table, Tabled};

#[cfg(feature = "cli")]
#[derive(Parser)]
#[command(name = "xray", about = "Analyze React Router route definitions", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[cfg(feature = "cli")]
#[derive(Subcommand)]
enum Commands {
    Analyze {
        #[arg(long)]
        router_file: Option<PathBuf>,
        #[arg(long, value_enum, default_value = "terminal")]
        format: AnalyzeFormat,
        #[arg(long)]
        output: Option<PathBuf>,
        #[arg(long, value_enum, default_value = "any")]
        fail_on: FailOnLevel,
        #[arg(long)]
        min_score: Option<f32>,
        #[arg(long)]
        no_color: bool,
        #[arg(long)]
        watch: bool,
    },
    Routes {
        #[arg(long, value_enum, default_value = "tree")]
        format: RoutesFormat,
        #[arg(long)]
        router_file: Option<PathBuf>,
    },
    Check {
        #[arg(long)]
        rule: Vec<String>,
        #[arg(long)]
        config: Option<PathBuf>,
        #[arg(long)]
        router_file: Option<PathBuf>,
    },
    Report {
        #[arg(long, default_value = "./xray-report.html")]
        output: PathBuf,
        #[arg(long)]
        open: bool,
        #[arg(long)]
        active_path: Option<String>,
        #[arg(long)]
        router_file: Option<PathBuf>,
    },
}

#[cfg(feature = "cli")]
#[derive(Copy, Clone, Debug, ValueEnum, Eq, PartialEq)]
enum AnalyzeFormat {
    Terminal,
    Json,
    Html,
}

#[cfg(feature = "cli")]
#[derive(Copy, Clone, Debug, ValueEnum, Eq, PartialEq)]
enum RoutesFormat {
    Tree,
    List,
    Json,
}

#[cfg(feature = "cli")]
#[derive(Copy, Clone, Debug, ValueEnum, Eq, PartialEq)]
enum FailOnLevel {
    Warn,
    Error,
    Any,
}

#[cfg(feature = "cli")]
#[derive(Debug, Clone, serde::Deserialize, Default)]
#[serde(default)]
struct XrayConfig {
    routerFile: Option<String>,
    rules: RuleConfig,
    thresholds: ThresholdConfig,
}

#[cfg(feature = "cli")]
#[derive(Debug, Clone, serde::Deserialize, Default)]
#[serde(default)]
struct RuleConfig {
    missingErrorBoundary: Option<serde_json::Value>,
    missingLoader: Option<serde_json::Value>,
    deepNesting: Option<serde_json::Value>,
    noLazyLoading: Option<serde_json::Value>,
    duplicatePath: Option<serde_json::Value>,
    ambiguousWildcard: Option<serde_json::Value>,
}

#[cfg(feature = "cli")]
#[derive(Debug, Clone, serde::Deserialize, Default)]
#[serde(default)]
struct ThresholdConfig {
    maxComplexityScore: Option<f32>,
}

#[cfg(feature = "cli")]
fn main() {
    let cli = Cli::parse();
    let code = run(cli).unwrap_or_else(|err| {
        eprintln!("xray failed: {err}");
        1
    });
    std::process::exit(code);
}

#[cfg(feature = "cli")]
fn run(cli: Cli) -> anyhow::Result<i32> {
    match cli.command {
        Commands::Analyze {
            router_file,
            format,
            output,
            fail_on,
            min_score,
            no_color,
            watch,
        } => {
            if watch {
                run_watch(router_file, format, output, fail_on, min_score, no_color)?;
                Ok(0)
            } else {
                let (tree, report, path) = load_and_analyze(router_file, None)?;
                emit_analyze(&tree, &report, &path, format, output.as_deref(), no_color)?;
                Ok(exit_for_thresholds(&report, fail_on, min_score))
            }
        }
        Commands::Routes { format, router_file } => {
            let (tree, report, _) = load_and_analyze(router_file, None)?;
            emit_routes(&tree, &report, format)?;
            Ok(0)
        }
        Commands::Check {
            rule: _rule,
            config,
            router_file,
        } => {
            let (tree, report, _) = load_and_analyze(router_file, config.as_deref())?;
            let _ = tree;
            let mut any_error = false;
            for issue in &report.issues {
                if is_error_issue(issue) {
                    any_error = true;
                    println!("ERROR: {}", issue_label(issue));
                } else {
                    println!("WARN: {}", issue_label(issue));
                }
            }
            Ok(if any_error { 1 } else { 0 })
        }
        Commands::Report {
            output,
            open,
            active_path,
            router_file,
        } => {
            let (tree, report, path) = load_and_analyze(router_file, None)?;
            let app_name = path
                .parent()
                .and_then(|p| p.file_name())
                .and_then(|n| n.to_str())
                .unwrap_or("app")
                .to_owned();
            let html = generate_html_report(
                &tree,
                &report,
                &HtmlReportOptions {
                    app_name,
                    active_path,
                },
            );
            fs::write(&output, html)?;
            println!("Wrote {}", output.display());
            if open {
                open_in_browser(&output)?;
            }
            Ok(0)
        }
    }
}

#[cfg(feature = "cli")]
fn run_watch(
    router_file: Option<PathBuf>,
    format: AnalyzeFormat,
    output: Option<PathBuf>,
    fail_on: FailOnLevel,
    min_score: Option<f32>,
    no_color: bool,
) -> anyhow::Result<()> {
    let path = detect_router_file(router_file, None)?;
    let mut last = file_mtime(&path);
    loop {
        let now = file_mtime(&path);
        if now > last {
            let (tree, report, used) = load_and_analyze(Some(path.clone()), None)?;
            emit_analyze(&tree, &report, &used, format, output.as_deref(), no_color)?;
            let code = exit_for_thresholds(&report, fail_on, min_score);
            if code != 0 {
                eprintln!("watch check failed with exit code {}", code);
            }
            last = now;
        }
        thread::sleep(Duration::from_millis(800));
    }
}

#[cfg(feature = "cli")]
fn load_and_analyze(
    router_file: Option<PathBuf>,
    config_file: Option<&Path>,
) -> anyhow::Result<(ParsedRouteTree, AnalysisReport, PathBuf)> {
    let path = detect_router_file(router_file, config_file)?;
    let src = fs::read_to_string(&path)?;
    let tree = parse_source(&src, path.to_str());
    let report = analyze_tree(&tree);
    Ok((tree, report, path))
}

#[cfg(feature = "cli")]
fn detect_router_file(
    router_file: Option<PathBuf>,
    config_file: Option<&Path>,
) -> anyhow::Result<PathBuf> {
    if let Some(path) = router_file {
        return Ok(path);
    }
    if let Some(cfg_file) = config_file {
        if cfg_file.exists() {
            let data = fs::read_to_string(cfg_file)?;
            let cfg: XrayConfig = serde_json::from_str(&data).unwrap_or_default();
            if let Some(router) = cfg.routerFile {
                return Ok(PathBuf::from(router));
            }
        }
    }
    if Path::new("xray.config.json").exists() {
        let data = fs::read_to_string("xray.config.json")?;
        let cfg: XrayConfig = serde_json::from_str(&data).unwrap_or_default();
        if let Some(router) = cfg.routerFile {
            return Ok(PathBuf::from(router));
        }
    }

    let candidates = ["src/router.tsx", "src/App.tsx", "app/router.ts"];
    for candidate in candidates {
        let p = PathBuf::from(candidate);
        if p.exists() {
            return Ok(p);
        }
    }
    anyhow::bail!("could not detect router file, pass --router-file")
}

#[cfg(feature = "cli")]
fn emit_analyze(
    tree: &ParsedRouteTree,
    report: &AnalysisReport,
    path: &Path,
    format: AnalyzeFormat,
    output: Option<&Path>,
    no_color: bool,
) -> anyhow::Result<()> {
    let app_name = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("app")
        .to_owned();
    let body = match format {
        AnalyzeFormat::Terminal => terminal_report(tree, report, path, no_color),
        AnalyzeFormat::Json => serde_json::to_string_pretty(report)?,
        AnalyzeFormat::Html => generate_html_report(
            tree,
            report,
            &HtmlReportOptions {
                app_name,
                active_path: None,
            },
        ),
    };

    if let Some(file) = output {
        fs::write(file, body)?;
    } else {
        println!("{body}");
    }
    Ok(())
}

#[cfg(feature = "cli")]
fn emit_routes(tree: &ParsedRouteTree, report: &AnalysisReport, format: RoutesFormat) -> anyhow::Result<()> {
    match format {
        RoutesFormat::Json => println!("{}", serde_json::to_string_pretty(tree)?),
        RoutesFormat::List => {
            for r in &report.routes_flat {
                println!("{}", r.full_path);
            }
        }
        RoutesFormat::Tree => {
            for root in &tree.roots {
                print_tree(root, "", true, "");
            }
        }
    }
    Ok(())
}

#[cfg(feature = "cli")]
fn terminal_report(tree: &ParsedRouteTree, report: &AnalysisReport, path: &Path, no_color: bool) -> String {
    let header = format!(
        "Project: {}    Routes: {}    Score: {}/100 {}",
        path.parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("app"),
        report.route_count,
        report.complexity_score.round() as i32,
        if report.complexity_score > 60.0 { "⚠" } else { "✓" }
    );

    #[derive(Tabled)]
    struct Row {
        path: String,
        depth: usize,
        lazy: bool,
        loader: bool,
        error_boundary: bool,
    }
    let rows = report
        .routes_flat
        .iter()
        .map(|r| Row {
            path: r.full_path.clone(),
            depth: r.depth,
            lazy: r.is_lazy,
            loader: r.has_loader,
            error_boundary: r.has_error_boundary,
        })
        .collect::<Vec<_>>();

    let table = Table::new(rows).to_string();
    let mut issue_lines = Vec::new();
    for issue in &report.issues {
        let is_err = is_error_issue(issue);
        let prefix = if is_err { "⛔ ERROR" } else { "⚠ WARN" };
        let line = if no_color {
            format!("{prefix}  {}", issue_label(issue))
        } else if is_err {
            format!("{}  {}", prefix.red().bold(), issue_label(issue))
        } else {
            format!("{}  {}", prefix.yellow().bold(), issue_label(issue))
        };
        issue_lines.push(line);
    }
    let issues_render = if issue_lines.is_empty() {
        "No issues.".to_owned()
    } else {
        issue_lines.join("\n")
    };

    let mut tree_lines = Vec::new();
    for root in &tree.roots {
        tree_to_lines(root, "", true, "", &mut tree_lines);
    }

    format!(
        "┌─ react-router-xray ───────────────────────────────────────┐\n│  {header}\n└───────────────────────────────────────────────────────────┘\n\nRoute Tree\n──────────\n{}\n\nRoutes\n──────\n{}\n\nIssues ({})\n──────────\n{}\n\nComplexity Score: {}/100 {}",
        tree_lines.join("\n"),
        table,
        report.issues.len(),
        issues_render,
        report.complexity_score.round() as i32,
        if report.complexity_score > 60.0 {
            "⚠ Above recommended threshold (60)"
        } else {
            "✓ Within recommended threshold"
        }
    )
}

#[cfg(feature = "cli")]
fn is_error_issue(issue: &RouteIssue) -> bool {
    matches!(
        issue,
        RouteIssue::MissingErrorBoundary { .. }
            | RouteIssue::DuplicatePath { .. }
            | RouteIssue::DeadRoute { .. }
    )
}

#[cfg(feature = "cli")]
fn issue_label(issue: &RouteIssue) -> String {
    match issue {
        RouteIssue::MissingErrorBoundary { path, .. } => format!("{path} — Missing ErrorBoundary"),
        RouteIssue::MissingLoader { path, .. } => format!("{path} — Missing Loader"),
        RouteIssue::DuplicatePath { path, .. } => format!("{path} — Duplicate Path"),
        RouteIssue::DeadRoute { route_id, reason } => format!("{route_id} — Dead Route ({reason})"),
        RouteIssue::AmbiguousWildcard { path } => format!("{path} — Ambiguous Wildcard"),
        RouteIssue::DeepNesting { depth, path } => format!("{path} — Deep nesting (depth: {depth})"),
        RouteIssue::NoLazyLoading { path, .. } => format!("{path} — No lazy loading"),
    }
}

#[cfg(feature = "cli")]
fn exit_for_thresholds(report: &AnalysisReport, fail_on: FailOnLevel, min_score: Option<f32>) -> i32 {
    if let Some(max) = min_score {
        if report.complexity_score > max {
            return 1;
        }
    }
    let any_warn = !report.issues.is_empty();
    let any_error = report.issues.iter().any(is_error_issue);

    match fail_on {
        FailOnLevel::Warn | FailOnLevel::Any if any_warn => 1,
        FailOnLevel::Error if any_error => 1,
        _ => 0,
    }
}

#[cfg(feature = "cli")]
fn file_mtime(path: &Path) -> SystemTime {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
}

#[cfg(feature = "cli")]
fn print_tree(node: &react_router_xray_core::parser::RouteNode, prefix: &str, last: bool, parent_path: &str) {
    let mut lines = Vec::new();
    tree_to_lines(node, prefix, last, parent_path, &mut lines);
    for line in lines {
        println!("{line}");
    }
}

#[cfg(feature = "cli")]
fn tree_to_lines(
    node: &react_router_xray_core::parser::RouteNode,
    prefix: &str,
    last: bool,
    parent_path: &str,
    out: &mut Vec<String>,
) {
    let name = node.path.clone().unwrap_or_else(|| "(root layout)".to_owned());
    let full_path = if name.starts_with('/') {
        name.clone()
    } else if name == "(root layout)" {
        "/".to_owned()
    } else {
        format!("{}/{}", parent_path.trim_end_matches('/'), name)
    };
    let mark = if prefix.is_empty() {
        ""
    } else if last {
        "└── "
    } else {
        "├── "
    };
    out.push(format!("{prefix}{mark}{full_path}"));
    let child_prefix = if prefix.is_empty() {
        "".to_owned()
    } else if last {
        format!("{prefix}    ")
    } else {
        format!("{prefix}│   ")
    };
    for (idx, child) in node.children.iter().enumerate() {
        let child_last = idx + 1 == node.children.len();
        tree_to_lines(child, &child_prefix, child_last, &full_path, out);
    }
}

#[cfg(feature = "cli")]
fn open_in_browser(path: &Path) -> anyhow::Result<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path.to_string_lossy()])
            .status()?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(path).status()?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(path).status()?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Ok(())
}

#[cfg(not(feature = "cli"))]
fn main() {
    eprintln!("The `xray` binary requires the `cli` feature.");
    std::process::exit(1);
}
