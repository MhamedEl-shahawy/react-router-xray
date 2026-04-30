use crate::analyzer::FlatRoute;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParsedPattern {
    pub raw: String,
    pub segments: Vec<String>,
    pub dynamic_params: Vec<String>,
    pub has_wildcard: bool,
}

pub fn parse_pattern(pattern: &str) -> ParsedPattern {
    let segments = pattern
        .split('/')
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    let dynamic_params = segments
        .iter()
        .filter(|s| s.starts_with(':'))
        .map(|s| s.trim_start_matches(':').to_owned())
        .collect::<Vec<_>>();
    let has_wildcard = segments.iter().any(|s| s.contains('*'));

    ParsedPattern {
        raw: pattern.to_owned(),
        segments,
        dynamic_params,
        has_wildcard,
    }
}

pub fn match_path(routes: &[FlatRoute], pathname: &str) -> Vec<String> {
    let mut router = matchit::Router::new();
    for route in routes {
        let _ = router.insert(route.full_path.clone(), route.route_id.clone());
    }

    match router.at(pathname) {
        Ok(matched) => vec![matched.value.clone()],
        Err(_) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analyzer::FlatRoute;

    #[test]
    fn parses_pattern_segments() {
        let p = parse_pattern("/users/:id/*");
        assert_eq!(p.dynamic_params, vec!["id"]);
        assert!(p.has_wildcard);
        assert_eq!(p.segments, vec!["users", ":id", "*"]);
    }

    #[test]
    fn matches_path_with_matchit() {
        let routes = vec![
            FlatRoute {
                route_id: "r1".into(),
                full_path: "/".into(),
                depth: 1,
                is_lazy: false,
                has_loader: false,
                has_action: false,
                has_error_boundary: false,
            },
            FlatRoute {
                route_id: "r2".into(),
                full_path: "/users/:id".into(),
                depth: 2,
                is_lazy: true,
                has_loader: true,
                has_action: false,
                has_error_boundary: true,
            },
        ];
        let matched = match_path(&routes, "/users/42");
        assert_eq!(matched, vec!["r2"]);
    }
}
