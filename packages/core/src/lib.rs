pub mod analyzer;
pub mod matcher;
pub mod parser;
pub mod report;
pub mod serializer;

use analyzer::{analyze_tree, AnalysisReport};
use parser::parse_input;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AnalysisResult {
    pub score: f32,
    pub routes: Vec<String>,
    pub report: AnalysisReport,
}

pub fn analyze(input: &str) -> AnalysisResult {
    let tree = parse_input(input, None);
    let report = analyze_tree(&tree);
    let routes = report
        .routes_flat
        .iter()
        .map(|r| r.full_path.clone())
        .collect::<Vec<_>>();

    AnalysisResult {
        score: report.complexity_score,
        routes,
        report,
    }
}

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn analyze_routes(input: &str) -> String {
    serde_json::to_string(&analyze(input))
        .unwrap_or_else(|_| "{\"score\":0,\"routes\":[],\"report\":null}".into())
}

#[cfg(feature = "napi")]
mod napi_exports {
    use super::analyze;
    use napi_derive::napi;

    #[napi]
    pub fn analyze_routes(input: String) -> String {
        serde_json::to_string(&analyze(&input))
            .unwrap_or_else(|_| "{\"score\":0,\"routes\":[],\"report\":null}".into())
    }
}
