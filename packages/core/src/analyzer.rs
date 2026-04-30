use crate::parser::{ParsedRouteTree, RouteNode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlatRoute {
    pub route_id: String,
    pub full_path: String,
    pub depth: usize,
    pub is_lazy: bool,
    pub has_loader: bool,
    pub has_action: bool,
    pub has_error_boundary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisReport {
    pub route_count: usize,
    pub max_nesting_depth: usize,
    pub dynamic_param_count: usize,
    pub wildcard_count: usize,
    pub lazy_route_count: usize,
    pub eager_route_count: usize,
    pub issues: Vec<RouteIssue>,
    pub complexity_score: f32,
    pub routes_flat: Vec<FlatRoute>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RouteIssue {
    MissingErrorBoundary { route_id: String, path: String },
    MissingLoader { route_id: String, path: String },
    DuplicatePath { path: String, route_ids: Vec<String> },
    DeadRoute { route_id: String, reason: String },
    AmbiguousWildcard { path: String },
    DeepNesting { depth: usize, path: String },
    NoLazyLoading { route_id: String, path: String },
}

pub fn analyze_tree(tree: &ParsedRouteTree) -> AnalysisReport {
    let mut routes_flat = Vec::new();
    for root in &tree.roots {
        flatten_route(root, "", 1, &mut routes_flat);
    }

    let route_count = routes_flat.len();
    let max_nesting_depth = routes_flat.iter().map(|r| r.depth).max().unwrap_or(0);
    let dynamic_param_count = routes_flat
        .iter()
        .map(|r| r.full_path.matches(':').count())
        .sum();
    let wildcard_count = routes_flat
        .iter()
        .map(|r| r.full_path.matches('*').count())
        .sum();
    let lazy_route_count = routes_flat.iter().filter(|r| r.is_lazy).count();
    let eager_route_count = route_count.saturating_sub(lazy_route_count);

    let issues = detect_issues(&routes_flat);
    let complexity_score = complexity_score(
        max_nesting_depth,
        dynamic_param_count,
        wildcard_count,
        eager_route_count,
    );

    AnalysisReport {
        route_count,
        max_nesting_depth,
        dynamic_param_count,
        wildcard_count,
        lazy_route_count,
        eager_route_count,
        issues,
        complexity_score,
        routes_flat,
    }
}

fn flatten_route(route: &RouteNode, parent_path: &str, depth: usize, out: &mut Vec<FlatRoute>) {
    let full_path = resolve_path(parent_path, route.path.as_deref());
    out.push(FlatRoute {
        route_id: route.id.clone(),
        full_path: full_path.clone(),
        depth,
        is_lazy: route.is_lazy,
        has_loader: route.has_loader,
        has_action: route.has_action,
        has_error_boundary: route.has_error_boundary,
    });

    for child in &route.children {
        flatten_route(child, &full_path, depth + 1, out);
    }
}

fn resolve_path(parent: &str, path: Option<&str>) -> String {
    match path {
        Some(p) if p.starts_with('/') => normalize(p),
        Some(p) if !p.is_empty() => normalize(&format!("{}/{}", parent, p)),
        _ => normalize(parent),
    }
}

fn normalize(path: &str) -> String {
    let mut p = path.replace("//", "/");
    if p.is_empty() {
        p.push('/');
    }
    if !p.starts_with('/') {
        p.insert(0, '/');
    }
    if p.len() > 1 && p.ends_with('/') {
        p.pop();
    }
    p
}

fn detect_issues(routes: &[FlatRoute]) -> Vec<RouteIssue> {
    let mut issues = Vec::new();
    let mut by_path: HashMap<String, Vec<String>> = HashMap::new();
    let mut has_lazy = false;

    for route in routes {
        by_path
            .entry(route.full_path.clone())
            .or_default()
            .push(route.route_id.clone());
        has_lazy |= route.is_lazy;

        if !route.has_error_boundary {
            issues.push(RouteIssue::MissingErrorBoundary {
                route_id: route.route_id.clone(),
                path: route.full_path.clone(),
            });
        }
        if !route.has_loader {
            issues.push(RouteIssue::MissingLoader {
                route_id: route.route_id.clone(),
                path: route.full_path.clone(),
            });
        }
        if route.depth > 4 {
            issues.push(RouteIssue::DeepNesting {
                depth: route.depth,
                path: route.full_path.clone(),
            });
        }
        if route.full_path.ends_with("/*") && route.full_path != "/*" {
            issues.push(RouteIssue::AmbiguousWildcard {
                path: route.full_path.clone(),
            });
        }
    }

    for (path, route_ids) in by_path {
        if route_ids.len() > 1 {
            issues.push(RouteIssue::DuplicatePath { path, route_ids });
        }
    }

    if !has_lazy {
        for route in routes {
            issues.push(RouteIssue::NoLazyLoading {
                route_id: route.route_id.clone(),
                path: route.full_path.clone(),
            });
        }
    }

    for route in routes {
        if route.full_path == "/" && routes.iter().any(|r| r.full_path == "/index") {
            issues.push(RouteIssue::DeadRoute {
                route_id: route.route_id.clone(),
                reason: "index route shadowed by root path".to_owned(),
            });
            break;
        }
    }

    issues
}

fn complexity_score(depth: usize, params: usize, wildcards: usize, eager_large_routes: usize) -> f32 {
    let raw = (depth as f32 * 3.0)
        + (params as f32 * 2.0)
        + (wildcards as f32 * 4.0)
        + (eager_large_routes as f32);
    (raw / 100.0 * 100.0).clamp(0.0, 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::{ParsedRouteTree, RouteNode};

    fn node(id: &str, path: Option<&str>, children: Vec<RouteNode>) -> RouteNode {
        RouteNode {
            id: id.to_owned(),
            path: path.map(ToOwned::to_owned),
            component_name: None,
            source_file: None,
            is_lazy: false,
            has_loader: false,
            has_action: false,
            has_error_boundary: false,
            children,
        }
    }

    #[test]
    fn computes_basic_counts() {
        let tree = ParsedRouteTree {
            roots: vec![node(
                "r1",
                Some("/"),
                vec![node("r2", Some("users/:id"), vec![]), node("r3", Some("*"), vec![])],
            )],
        };
        let report = analyze_tree(&tree);
        assert_eq!(report.route_count, 3);
        assert_eq!(report.max_nesting_depth, 2);
        assert_eq!(report.dynamic_param_count, 1);
        assert_eq!(report.wildcard_count, 1);
    }

    #[test]
    fn detects_duplicate_paths() {
        let tree = ParsedRouteTree {
            roots: vec![node("a", Some("/same"), vec![]), node("b", Some("/same"), vec![])],
        };
        let report = analyze_tree(&tree);
        assert!(report
            .issues
            .iter()
            .any(|i| matches!(i, RouteIssue::DuplicatePath { path, .. } if path == "/same")));
    }

    #[test]
    fn score_is_normalized() {
        let score = complexity_score(20, 20, 20, 200);
        assert_eq!(score, 100.0);
    }
}
