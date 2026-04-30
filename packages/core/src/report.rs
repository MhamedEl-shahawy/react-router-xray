use crate::analyzer::{AnalysisReport, FlatRoute, RouteIssue};
use crate::parser::{ParsedRouteTree, RouteNode};
use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct HtmlReportOptions {
    pub app_name: String,
    pub active_path: Option<String>,
}

impl Default for HtmlReportOptions {
    fn default() -> Self {
        Self {
            app_name: "react-router-xray".to_owned(),
            active_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct GraphNode {
    id: String,
    route_id: String,
    path: String,
    component: Option<String>,
    is_lazy: bool,
    has_loader: bool,
    has_error_boundary: bool,
    node_type: String,
    x: f32,
    y: f32,
    parent: Option<String>,
    pulse: bool,
}

#[derive(Debug, Clone, Serialize)]
struct GraphEdge {
    source: String,
    target: String,
}

#[derive(Debug, Clone, Serialize)]
struct GraphData {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
}

pub fn generate_html_report(
    tree: &ParsedRouteTree,
    report: &AnalysisReport,
    options: &HtmlReportOptions,
) -> String {
    let (graph, route_issues) = build_graph(tree, report, options.active_path.as_deref());
    let graph_json = serde_json::to_string(&graph).unwrap_or_else(|_| "{\"nodes\":[],\"edges\":[]}".to_owned());
    let summary = render_summary(report, options);
    let table = render_table(report, &route_issues);
    let issues = render_issues(report);
    let chart = render_complexity_chart(report);

    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{}</title><style>{}</style></head><body><main class=\"container\">{}{}{}{}{}<section class=\"card\"><h2>Interactive Route Graph</h2><svg id=\"graph\" viewBox=\"0 0 1200 640\" role=\"img\" aria-label=\"Route graph\"></svg><div id=\"tooltip\" class=\"tooltip\" hidden></div></section></main><script>const GRAPH_DATA={};{}</script></body></html>",
        escape_html(&options.app_name),
        styles(),
        summary,
        table,
        issues,
        chart,
        "<!-- graph section anchor -->",
        graph_json,
        script()
    )
}

fn render_summary(report: &AnalysisReport, options: &HtmlReportOptions) -> String {
    let (errors, warnings) = severity_breakdown(&report.issues);
    let score_class = if report.complexity_score < 40.0 {
        "score-good"
    } else if report.complexity_score <= 70.0 {
        "score-warn"
    } else {
        "score-bad"
    };

    format!(
        "<section class=\"card summary\"><h1>{}</h1><div class=\"summary-grid\"><div><strong>Routes</strong><span>{}</span></div><div><strong>Score</strong><span class=\"badge {}\">{:.0}/100</span></div><div><strong>Errors</strong><span>{}</span></div><div><strong>Warnings</strong><span>{}</span></div></div></section>",
        escape_html(&options.app_name),
        report.route_count,
        score_class,
        report.complexity_score,
        errors,
        warnings
    )
}

fn render_table(report: &AnalysisReport, issues_by_route: &HashMap<String, usize>) -> String {
    let mut rows = report.routes_flat.clone();
    rows.sort_by(|a, b| a.full_path.cmp(&b.full_path));
    let body = rows
        .iter()
        .map(|route| {
            let issue_count = issues_by_route.get(&route.route_id).copied().unwrap_or(0);
            format!(
                "<tr data-route-id=\"{}\"><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
                escape_html(&route.route_id),
                escape_html(&route.full_path),
                "-",
                bool_cell(route.is_lazy),
                bool_cell(route.has_loader),
                bool_cell(route.has_action),
                bool_cell(route.has_error_boundary),
                route.depth,
                issue_count
            )
        })
        .collect::<Vec<_>>()
        .join("");

    format!(
        "<section class=\"card\"><h2>Route Table</h2><table id=\"route-table\"><thead><tr><th data-sort=\"string\">Full Path</th><th data-sort=\"string\">Component</th><th data-sort=\"bool\">Lazy</th><th data-sort=\"bool\">Loader</th><th data-sort=\"bool\">Action</th><th data-sort=\"bool\">ErrorBoundary</th><th data-sort=\"number\">Depth</th><th data-sort=\"number\">Issues</th></tr></thead><tbody>{}</tbody></table></section>",
        body
    )
}

fn render_issues(report: &AnalysisReport) -> String {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    for issue in &report.issues {
        let item = issue_item(issue);
        if is_error(issue) {
            errors.push(item);
        } else {
            warnings.push(item);
        }
    }

    format!(
        "<section class=\"card\"><h2>Issues</h2><div class=\"issues-grid\"><div><h3>Errors ({})</h3><ul>{}</ul></div><div><h3>Warnings ({})</h3><ul>{}</ul></div></div></section>",
        errors.len(),
        errors.join(""),
        warnings.len(),
        warnings.join("")
    )
}

fn render_complexity_chart(report: &AnalysisReport) -> String {
    let mut points = report.routes_flat.clone();
    points.sort_by(|a, b| route_score(b).total_cmp(&route_score(a)));
    let bar_width = 16.0f32;
    let gap = 4.0f32;
    let height = 180.0f32;

    let bars = points
        .iter()
        .enumerate()
        .map(|(idx, route)| {
            let score = route_score(route).min(100.0);
            let h = (score / 100.0) * height;
            let x = idx as f32 * (bar_width + gap) + 50.0;
            let y = 220.0 - h;
            let color = if score < 40.0 {
                "#1db954"
            } else if score <= 70.0 {
                "#f2c14e"
            } else {
                "#e63946"
            };
            format!(
                "<g><rect x=\"{:.1}\" y=\"{:.1}\" width=\"{:.1}\" height=\"{:.1}\" fill=\"{}\" /><title>{}: {:.1}</title></g>",
                x,
                y,
                bar_width,
                h,
                color,
                escape_html(&route.full_path),
                score
            )
        })
        .collect::<Vec<_>>()
        .join("");

    format!(
        "<section class=\"card\"><h2>Complexity Breakdown</h2><svg viewBox=\"0 0 1200 260\" role=\"img\" aria-label=\"Complexity by route\"><rect x=\"0\" y=\"0\" width=\"1200\" height=\"260\" fill=\"#0f172a\"/><rect x=\"0\" y=\"0\" width=\"1200\" height=\"104\" fill=\"rgba(16,185,129,0.08)\"/><rect x=\"0\" y=\"104\" width=\"1200\" height=\"78\" fill=\"rgba(245,158,11,0.08)\"/><rect x=\"0\" y=\"182\" width=\"1200\" height=\"78\" fill=\"rgba(239,68,68,0.08)\"/><line x1=\"40\" y1=\"220\" x2=\"1180\" y2=\"220\" stroke=\"#64748b\"/>{}</svg></section>",
        bars
    )
}

fn build_graph(
    tree: &ParsedRouteTree,
    report: &AnalysisReport,
    active_path: Option<&str>,
) -> (GraphData, HashMap<String, usize>) {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut route_issues: HashMap<String, usize> = HashMap::new();
    for issue in &report.issues {
        for route_id in issue_route_ids(issue) {
            *route_issues.entry(route_id).or_insert(0) += 1;
        }
    }

    let mut idx = 0usize;
    for root in &tree.roots {
        append_graph_nodes(
            root,
            None,
            0,
            &mut idx,
            &mut nodes,
            &mut edges,
            active_path,
        );
    }
    (GraphData { nodes, edges }, route_issues)
}

fn append_graph_nodes(
    route: &RouteNode,
    parent: Option<String>,
    depth: usize,
    idx: &mut usize,
    nodes: &mut Vec<GraphNode>,
    edges: &mut Vec<GraphEdge>,
    active_path: Option<&str>,
) {
    let node_id = format!("node-{}", route.id);
    let path = route.path.clone().unwrap_or_else(|| "/".to_owned());
    let pulse = active_path.map(|a| a == path).unwrap_or(false);
    let node_type = classify_route(route, &path);
    let x = 140.0 + ((*idx % 10) as f32 * 100.0);
    let y = 80.0 + (depth as f32 * 90.0);

    if let Some(parent_id) = &parent {
        edges.push(GraphEdge {
            source: parent_id.clone(),
            target: node_id.clone(),
        });
    }

    nodes.push(GraphNode {
        id: node_id.clone(),
        route_id: route.id.clone(),
        path: path.clone(),
        component: route.component_name.clone(),
        is_lazy: route.is_lazy,
        has_loader: route.has_loader,
        has_error_boundary: route.has_error_boundary,
        node_type,
        x,
        y,
        parent: parent.clone(),
        pulse,
    });

    *idx += 1;
    for child in &route.children {
        append_graph_nodes(
            child,
            Some(node_id.clone()),
            depth + 1,
            idx,
            nodes,
            edges,
            active_path,
        );
    }
}

fn classify_route(route: &RouteNode, path: &str) -> String {
    if route.path.is_none() {
        "layout".to_owned()
    } else if path.contains('*') {
        "wildcard".to_owned()
    } else if path.contains(':') {
        "dynamic".to_owned()
    } else {
        "static".to_owned()
    }
}

fn route_score(route: &FlatRoute) -> f32 {
    let dynamic = route.full_path.matches(':').count() as f32 * 2.0;
    let wildcard = route.full_path.matches('*').count() as f32 * 4.0;
    let eager = if route.is_lazy { 0.0 } else { 1.0 };
    ((route.depth as f32 * 3.0) + dynamic + wildcard + eager).min(100.0)
}

fn issue_route_ids(issue: &RouteIssue) -> Vec<String> {
    match issue {
        RouteIssue::MissingErrorBoundary { route_id, .. } => vec![route_id.clone()],
        RouteIssue::MissingLoader { route_id, .. } => vec![route_id.clone()],
        RouteIssue::DeadRoute { route_id, .. } => vec![route_id.clone()],
        RouteIssue::NoLazyLoading { route_id, .. } => vec![route_id.clone()],
        RouteIssue::DuplicatePath { route_ids, .. } => route_ids.clone(),
        RouteIssue::AmbiguousWildcard { .. } | RouteIssue::DeepNesting { .. } => Vec::new(),
    }
}

fn severity_breakdown(issues: &[RouteIssue]) -> (usize, usize) {
    let errors = issues.iter().filter(|i| is_error(i)).count();
    (errors, issues.len().saturating_sub(errors))
}

fn is_error(issue: &RouteIssue) -> bool {
    matches!(
        issue,
        RouteIssue::MissingErrorBoundary { .. }
            | RouteIssue::DuplicatePath { .. }
            | RouteIssue::DeadRoute { .. }
    )
}

fn issue_item(issue: &RouteIssue) -> String {
    match issue {
        RouteIssue::MissingErrorBoundary { route_id, path } => format!(
            "<li><a href=\"#\" data-target=\"node-{}\">{}</a> Missing ErrorBoundary</li>",
            escape_html(route_id),
            escape_html(path)
        ),
        RouteIssue::MissingLoader { route_id, path } => format!(
            "<li><a href=\"#\" data-target=\"node-{}\">{}</a> Missing Loader</li>",
            escape_html(route_id),
            escape_html(path)
        ),
        RouteIssue::DuplicatePath { path, route_ids } => format!(
            "<li>{} Duplicate path ({})</li>",
            escape_html(path),
            escape_html(&route_ids.join(", "))
        ),
        RouteIssue::DeadRoute { route_id, reason } => format!(
            "<li><a href=\"#\" data-target=\"node-{}\">{}</a></li>",
            escape_html(route_id),
            escape_html(reason)
        ),
        RouteIssue::AmbiguousWildcard { path } => {
            format!("<li>{} Ambiguous wildcard</li>", escape_html(path))
        }
        RouteIssue::DeepNesting { depth, path } => format!(
            "<li>{} Deep nesting (depth {})</li>",
            escape_html(path),
            depth
        ),
        RouteIssue::NoLazyLoading { route_id, path } => format!(
            "<li><a href=\"#\" data-target=\"node-{}\">{}</a> No lazy loading</li>",
            escape_html(route_id),
            escape_html(path)
        ),
    }
}

fn bool_cell(v: bool) -> &'static str {
    if v { "Yes" } else { "No" }
}

fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn styles() -> &'static str {
    r#"
body{margin:0;background:#020617;color:#e2e8f0;font-family:Inter,system-ui,sans-serif}
.container{max-width:1200px;margin:0 auto;padding:20px;display:grid;gap:16px}
.card{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px}
.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.badge{padding:4px 10px;border-radius:999px}
.score-good{background:#14532d}.score-warn{background:#78350f}.score-bad{background:#7f1d1d}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px;border-bottom:1px solid #1e293b;text-align:left}
th{cursor:pointer}
.issues-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
#graph{width:100%;height:640px;background:#020617;border-radius:10px;border:1px solid #1e293b}
.tooltip{position:fixed;background:#0b1220;border:1px solid #334155;padding:8px;border-radius:8px;font-size:12px;max-width:300px}
.node.active{stroke:#f8fafc;stroke-width:3}
.pulse{animation:pulse 1.3s infinite}
@keyframes pulse{0%{r:9}50%{r:13}100%{r:9}}
"#
}

fn script() -> &'static str {
    r#"
const svg=document.getElementById('graph');
const tooltip=document.getElementById('tooltip');
const nodes=new Map();const links=[];const byId=new Map();
GRAPH_DATA.nodes.forEach(n=>byId.set(n.id,n));
function colorFor(t){if(t==='layout')return '#3b82f6';if(t==='dynamic')return '#f59e0b';if(t==='wildcard')return '#ef4444';return '#10b981';}
function mk(tag){return document.createElementNS('http://www.w3.org/2000/svg',tag);}
GRAPH_DATA.edges.forEach(e=>{const l=mk('line');l.setAttribute('stroke','#334155');l.setAttribute('stroke-width','1.5');svg.appendChild(l);links.push({el:l,...e});});
GRAPH_DATA.nodes.forEach(n=>{const g=mk('g');g.dataset.id=n.id;const c=mk('circle');c.setAttribute('r','9');c.setAttribute('fill',colorFor(n.node_type));c.classList.add('node');if(n.pulse)c.classList.add('pulse');const t=mk('text');t.textContent=n.path;t.setAttribute('x','12');t.setAttribute('fill','#cbd5e1');t.setAttribute('font-size','11');g.appendChild(c);g.appendChild(t);svg.appendChild(g);nodes.set(n.id,{data:n,g,c,t,vx:0,vy:0,drag:false});
g.addEventListener('mouseenter',ev=>{tooltip.hidden=false;tooltip.innerHTML=`<strong>${n.path}</strong><br/>component: ${n.component||'-'}<br/>${n.is_lazy?'lazy':'eager'} | loader: ${n.has_loader} | error boundary: ${n.has_error_boundary}`;tooltip.style.left=(ev.clientX+12)+'px';tooltip.style.top=(ev.clientY+12)+'px';});
g.addEventListener('mouseleave',()=>tooltip.hidden=true);
g.addEventListener('mousemove',ev=>{tooltip.style.left=(ev.clientX+12)+'px';tooltip.style.top=(ev.clientY+12)+'px';});
g.addEventListener('click',()=>highlightChain(n.id));});
let dragId=null;
svg.addEventListener('mousedown',ev=>{const g=ev.target.closest('g');if(!g)return;dragId=g.dataset.id;nodes.get(dragId).drag=true;});
window.addEventListener('mouseup',()=>{if(dragId&&nodes.get(dragId))nodes.get(dragId).drag=false;dragId=null;});
svg.addEventListener('mousemove',ev=>{if(!dragId)return;const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());const n=nodes.get(dragId);n.data.x=p.x;n.data.y=p.y;n.vx=0;n.vy=0;});
function highlightChain(id){nodes.forEach(n=>n.c.classList.remove('active'));let cur=byId.get(id);while(cur){const n=nodes.get(cur.id);if(n)n.c.classList.add('active');cur=cur.parent?byId.get(cur.parent):null;}}
document.querySelectorAll('a[data-target]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const id=a.dataset.target;highlightChain(id);}));
const repel=7000,spring=0.009,damp=0.92,target=80;
function tick(){
 const arr=[...nodes.values()];
 for(let i=0;i<arr.length;i++){for(let j=i+1;j<arr.length;j++){const a=arr[i],b=arr[j];let dx=b.data.x-a.data.x,dy=b.data.y-a.data.y;let d2=dx*dx+dy*dy+0.1;let f=repel/d2;let d=Math.sqrt(d2);let fx=(dx/d)*f,fy=(dy/d)*f;a.vx-=fx;a.vy-=fy;b.vx+=fx;b.vy+=fy;}}
 links.forEach(l=>{const a=nodes.get(l.source),b=nodes.get(l.target);let dx=b.data.x-a.data.x,dy=b.data.y-a.data.y;let d=Math.sqrt(dx*dx+dy*dy)+0.1;let f=(d-target)*spring;let fx=(dx/d)*f,fy=(dy/d)*f;a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy;});
 arr.forEach(n=>{if(!n.drag){n.vx*=damp;n.vy*=damp;n.data.x=Math.max(30,Math.min(1170,n.data.x+n.vx));n.data.y=Math.max(30,Math.min(610,n.data.y+n.vy));}n.g.setAttribute('transform',`translate(${n.data.x},${n.data.y})`);});
 links.forEach(l=>{const a=nodes.get(l.source).data,b=nodes.get(l.target).data;l.el.setAttribute('x1',a.x);l.el.setAttribute('y1',a.y);l.el.setAttribute('x2',b.x);l.el.setAttribute('y2',b.y);});
 requestAnimationFrame(tick);
}
function makeSortable(){const table=document.getElementById('route-table');const ths=table.querySelectorAll('th');ths.forEach((th,i)=>th.addEventListener('click',()=>{const type=th.dataset.sort;const body=table.tBodies[0];const rows=[...body.rows];const dir=th.dataset.dir==='asc'?'desc':'asc';ths.forEach(x=>x.dataset.dir='');th.dataset.dir=dir;rows.sort((a,b)=>{let av=a.cells[i].textContent.trim(),bv=b.cells[i].textContent.trim();if(type==='number'){av=Number(av);bv=Number(bv);}if(type==='bool'){av=av==='Yes'?1:0;bv=bv==='Yes'?1:0;}if(av<bv)return dir==='asc'?-1:1;if(av>bv)return dir==='asc'?1:-1;return 0;});rows.forEach(r=>body.appendChild(r));}));}
makeSortable();tick();
"#
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analyzer::{AnalysisReport, FlatRoute, RouteIssue};
    use crate::parser::{ParsedRouteTree, RouteNode};

    #[test]
    fn report_contains_nodes_and_issue_counts() {
        let tree = ParsedRouteTree {
            roots: vec![RouteNode {
                id: "r1".into(),
                path: Some("/".into()),
                component_name: Some("Home".into()),
                source_file: Some("src/router.tsx".into()),
                is_lazy: false,
                has_loader: true,
                has_action: false,
                has_error_boundary: false,
                children: vec![RouteNode {
                    id: "r2".into(),
                    path: Some("users/:id".into()),
                    component_name: Some("User".into()),
                    source_file: None,
                    is_lazy: true,
                    has_loader: true,
                    has_action: false,
                    has_error_boundary: true,
                    children: vec![],
                }],
            }],
        };
        let report = AnalysisReport {
            route_count: 2,
            max_nesting_depth: 2,
            dynamic_param_count: 1,
            wildcard_count: 0,
            lazy_route_count: 1,
            eager_route_count: 1,
            issues: vec![RouteIssue::MissingErrorBoundary {
                route_id: "r1".into(),
                path: "/".into(),
            }],
            complexity_score: 25.0,
            routes_flat: vec![
                FlatRoute {
                    route_id: "r1".into(),
                    full_path: "/".into(),
                    depth: 1,
                    is_lazy: false,
                    has_loader: true,
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
            ],
        };

        let html = generate_html_report(
            &tree,
            &report,
            &HtmlReportOptions {
                app_name: "fixture-app".into(),
                active_path: Some("/users/:id".into()),
            },
        );
        assert!(html.contains("node-r1"));
        assert!(html.contains("node-r2"));
        assert!(html.contains("Errors (1)"));
        assert!(html.contains("Warnings (0)"));
    }
}
