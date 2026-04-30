use crate::analyzer::AnalysisReport;
use crate::parser::ParsedRouteTree;

pub fn to_json(report: &AnalysisReport) -> String {
    serde_json::to_string_pretty(report).unwrap_or_else(|_| "{}".to_owned())
}

pub fn to_compact_binary(tree: &ParsedRouteTree) -> Vec<u8> {
    postcard::to_stdvec(tree).unwrap_or_default()
}

pub fn from_compact_binary(bytes: &[u8]) -> ParsedRouteTree {
    postcard::from_bytes(bytes).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analyzer::{AnalysisReport, FlatRoute, RouteIssue};
    use crate::parser::{ParsedRouteTree, RouteNode};

    #[test]
    fn serializes_report_to_json() {
        let report = AnalysisReport {
            route_count: 1,
            max_nesting_depth: 1,
            dynamic_param_count: 0,
            wildcard_count: 0,
            lazy_route_count: 0,
            eager_route_count: 1,
            issues: vec![RouteIssue::MissingLoader {
                route_id: "r1".into(),
                path: "/".into(),
            }],
            complexity_score: 3.0,
            routes_flat: vec![FlatRoute {
                route_id: "r1".into(),
                full_path: "/".into(),
                depth: 1,
                is_lazy: false,
                has_loader: false,
                has_action: false,
                has_error_boundary: false,
            }],
        };
        let json = to_json(&report);
        assert!(json.contains("\"route_count\": 1"));
    }

    #[test]
    fn round_trips_postcard_binary() {
        let tree = ParsedRouteTree {
            roots: vec![RouteNode {
                id: "r1".into(),
                path: Some("/".into()),
                component_name: Some("Home".into()),
                source_file: Some("app.tsx".into()),
                is_lazy: false,
                has_loader: true,
                has_action: false,
                has_error_boundary: true,
                children: vec![],
            }],
        };
        let bytes = to_compact_binary(&tree);
        let decoded = from_compact_binary(&bytes);
        assert_eq!(decoded, tree);
    }
}
