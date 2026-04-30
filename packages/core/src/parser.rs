use serde::{Deserialize, Serialize};
use swc_core::common::{sync::Lrc, FileName, SourceMap};
use swc_core::ecma::ast::*;
use swc_core::ecma::parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};
use swc_core::ecma::visit::{Visit, VisitWith};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RouteNode {
    pub id: String,
    pub path: Option<String>,
    pub component_name: Option<String>,
    pub source_file: Option<String>,
    pub is_lazy: bool,
    pub has_loader: bool,
    pub has_action: bool,
    pub has_error_boundary: bool,
    pub children: Vec<RouteNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct ParsedRouteTree {
    pub roots: Vec<RouteNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRouteManifest {
    pub routes: Vec<RouteNode>,
}

pub fn parse_input(input: &str, source_file: Option<&str>) -> ParsedRouteTree {
    let trimmed = input.trim_start();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return parse_json_manifest(input);
    }
    parse_source(input, source_file)
}

pub fn parse_json_manifest(input: &str) -> ParsedRouteTree {
    if let Ok(manifest) = serde_json::from_str::<JsonRouteManifest>(input) {
        return ParsedRouteTree {
            roots: manifest.routes,
        };
    }

    if let Ok(routes) = serde_json::from_str::<Vec<RouteNode>>(input) {
        return ParsedRouteTree { roots: routes };
    }

    ParsedRouteTree::default()
}

pub fn parse_source(input: &str, source_file: Option<&str>) -> ParsedRouteTree {
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(
        FileName::Custom(source_file.unwrap_or("inline.tsx").to_owned()).into(),
        input.to_owned(),
    );
    let lexer = Lexer::new(
        Syntax::Typescript(TsSyntax {
            tsx: true,
            decorators: true,
            ..Default::default()
        }),
        EsVersion::Es2022,
        StringInput::from(&*fm),
        None,
    );
    let mut parser = Parser::new_from(lexer);
    let Ok(module) = parser.parse_module() else {
        return ParsedRouteTree::default();
    };

    let mut visitor = RouteVisitor::new(source_file.map(ToOwned::to_owned));
    module.visit_with(&mut visitor);

    ParsedRouteTree {
        roots: visitor.routes,
    }
}

struct RouteVisitor {
    routes: Vec<RouteNode>,
    route_seq: usize,
    known_lazy_components: Vec<String>,
    source_file: Option<String>,
}

impl RouteVisitor {
    fn new(source_file: Option<String>) -> Self {
        Self {
            routes: Vec::new(),
            route_seq: 0,
            known_lazy_components: Vec::new(),
            source_file,
        }
    }

    fn next_id(&mut self) -> String {
        self.route_seq += 1;
        format!("route_{}", self.route_seq)
    }

    fn route_from_object(&mut self, obj: &ObjectLit) -> RouteNode {
        let mut node = RouteNode {
            id: self.next_id(),
            path: None,
            component_name: None,
            source_file: self.source_file.clone(),
            is_lazy: false,
            has_loader: false,
            has_action: false,
            has_error_boundary: false,
            children: Vec::new(),
        };

        for prop in &obj.props {
            let PropOrSpread::Prop(prop) = prop else {
                continue;
            };
            let Prop::KeyValue(kv) = &**prop else {
                continue;
            };
            let key = prop_name(&kv.key);
            match key.as_deref() {
                Some("path") => {
                    node.path = expr_to_string(&kv.value);
                }
                Some("element") | Some("Component") => {
                    node.component_name = infer_component_name(&kv.value);
                    if let Some(name) = &node.component_name {
                        node.is_lazy = self.known_lazy_components.contains(name);
                    }
                }
                Some("lazy") => {
                    node.is_lazy = true;
                }
                Some("loader") => {
                    node.has_loader = true;
                }
                Some("action") => {
                    node.has_action = true;
                }
                Some("errorElement") | Some("ErrorBoundary") => {
                    node.has_error_boundary = true;
                }
                Some("children") => {
                    if let Expr::Array(arr) = &*kv.value {
                        node.children = arr
                            .elems
                            .iter()
                            .flatten()
                            .filter_map(|elem| match &*elem.expr {
                                Expr::Object(obj) => Some(self.route_from_object(obj)),
                                _ => None,
                            })
                            .collect();
                    }
                }
                _ => {}
            }
        }

        node
    }

    fn route_from_jsx_opening(&mut self, opening: &JSXOpeningElement) -> RouteNode {
        let mut node = RouteNode {
            id: self.next_id(),
            path: None,
            component_name: None,
            source_file: self.source_file.clone(),
            is_lazy: false,
            has_loader: false,
            has_action: false,
            has_error_boundary: false,
            children: Vec::new(),
        };

        for attr in &opening.attrs {
            let JSXAttrOrSpread::JSXAttr(attr) = attr else {
                continue;
            };
            let JSXAttrName::Ident(name) = &attr.name else {
                continue;
            };
            let key = name.sym.as_ref();
            match key {
                "path" => {
                    if let Some(JSXAttrValue::Lit(Lit::Str(s))) = &attr.value {
                        node.path = Some(s.value.to_string());
                    }
                }
                "element" | "Component" => {
                    if let Some(value) = &attr.value {
                        node.component_name = jsx_attr_component(value);
                        if let Some(name) = &node.component_name {
                            node.is_lazy = self.known_lazy_components.contains(name);
                        }
                    }
                }
                "loader" => node.has_loader = true,
                "action" => node.has_action = true,
                "errorElement" => node.has_error_boundary = true,
                _ => {}
            }
        }

        node
    }
}

impl Visit for RouteVisitor {
    fn visit_var_declarator(&mut self, n: &VarDeclarator) {
        if let Pat::Ident(ident) = &n.name {
            if let Some(init) = &n.init {
                if is_react_lazy_import(init) {
                    self.known_lazy_components.push(ident.id.sym.to_string());
                }
            }
        }
        n.visit_children_with(self);
    }

    fn visit_call_expr(&mut self, n: &CallExpr) {
        let mut is_router_call = false;
        if let Callee::Expr(expr) = &n.callee {
            if let Expr::Ident(ident) = &**expr {
                is_router_call = ident.sym == *"createBrowserRouter";
            }
        }

        if is_router_call {
            if let Some(first_arg) = n.args.first() {
                if let Expr::Array(arr) = &*first_arg.expr {
                    for elem in arr.elems.iter().flatten() {
                        if let Expr::Object(obj) = &*elem.expr {
                            let route = self.route_from_object(obj);
                            self.routes.push(route);
                        }
                    }
                }
            }
        }
        n.visit_children_with(self);
    }

    fn visit_jsx_element(&mut self, n: &JSXElement) {
        if let JSXElementName::Ident(name) = &n.opening.name {
            if name.sym == *"Route" {
                let mut route = self.route_from_jsx_opening(&n.opening);
                route.children = n
                    .children
                    .iter()
                    .filter_map(|child| match child {
                        JSXElementChild::JSXElement(child_el) => {
                            if let JSXElementName::Ident(child_name) = &child_el.opening.name {
                                if child_name.sym == *"Route" {
                                    Some(self.route_from_jsx_opening(&child_el.opening))
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        }
                        _ => None,
                    })
                    .collect();
                self.routes.push(route);
            }
        }
        n.visit_children_with(self);
    }
}

fn prop_name(key: &PropName) -> Option<String> {
    match key {
        PropName::Ident(id) => Some(id.sym.to_string()),
        PropName::Str(s) => Some(s.value.to_string()),
        _ => None,
    }
}

fn expr_to_string(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Lit(Lit::Str(s)) => Some(s.value.to_string()),
        _ => None,
    }
}

fn infer_component_name(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Ident(i) => Some(i.sym.to_string()),
        Expr::JSXElement(el) => match &el.opening.name {
            JSXElementName::Ident(i) => Some(i.sym.to_string()),
            _ => None,
        },
        _ => None,
    }
}

fn jsx_attr_component(value: &JSXAttrValue) -> Option<String> {
    match value {
        JSXAttrValue::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => infer_component_name(expr),
            _ => None,
        },
        _ => None,
    }
}

fn is_react_lazy_import(expr: &Expr) -> bool {
    let Expr::Call(call) = expr else {
        return false;
    };
    let Callee::Expr(callee_expr) = &call.callee else {
        return false;
    };

    let is_lazy_callee = match &**callee_expr {
        Expr::Member(member) => {
            if let Expr::Ident(obj) = &*member.obj {
                let prop = member.prop.as_ident();
                obj.sym == *"React" && prop.map(|p| p.sym == *"lazy").unwrap_or(false)
            } else {
                false
            }
        }
        Expr::Ident(id) => id.sym == *"lazy",
        _ => false,
    };
    if !is_lazy_callee {
        return false;
    }

    let Some(first) = call.args.first() else {
        return false;
    };
    let Expr::Arrow(arrow) = &*first.expr else {
        return false;
    };
    match &*arrow.body {
        BlockStmtOrExpr::Expr(expr) => matches!(&**expr, Expr::Call(c) if matches!(&c.callee, Callee::Import(_))),
        BlockStmtOrExpr::BlockStmt(block) => block.stmts.iter().any(|stmt| match stmt {
            Stmt::Return(ret) => ret
                .arg
                .as_ref()
                .map(|arg| matches!(&**arg, Expr::Call(c) if matches!(&c.callee, Callee::Import(_))))
                .unwrap_or(false),
            _ => false,
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_json_manifest_object() {
        let input = r#"{"routes":[{"id":"r1","path":"/","component_name":"Home","source_file":"app.tsx","is_lazy":false,"has_loader":true,"has_action":false,"has_error_boundary":true,"children":[]}]}"#;
        let tree = parse_json_manifest(input);
        assert_eq!(tree.roots.len(), 1);
        assert_eq!(tree.roots[0].path.as_deref(), Some("/"));
        assert!(tree.roots[0].has_loader);
    }

    #[test]
    fn parses_create_browser_router_array() {
        let input = r#"
          const routes = createBrowserRouter([
            {
              path: "/",
              element: <Home />,
              loader: homeLoader,
              children: [{ path: "dashboard", element: <Dashboard /> }]
            }
          ]);
        "#;
        let tree = parse_source(input, Some("routes.tsx"));
        assert_eq!(tree.roots.len(), 1);
        assert_eq!(tree.roots[0].path.as_deref(), Some("/"));
        assert_eq!(tree.roots[0].children.len(), 1);
        assert!(tree.roots[0].has_loader);
    }

    #[test]
    fn parses_jsx_route_tree_and_lazy() {
        let input = r#"
          const Dashboard = React.lazy(() => import('./Dashboard'));
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route path="dashboard" element={<Dashboard />} />
            </Route>
          </Routes>;
        "#;
        let tree = parse_source(input, Some("jsx.tsx"));
        assert!(!tree.roots.is_empty());
        let dashboard = tree
            .roots
            .iter()
            .flat_map(|r| r.children.iter())
            .find(|c| c.path.as_deref() == Some("dashboard"))
            .expect("dashboard route exists");
        assert!(dashboard.is_lazy);
    }
}
