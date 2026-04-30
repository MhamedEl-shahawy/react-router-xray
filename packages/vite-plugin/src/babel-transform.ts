import { transformSync, type PluginObj } from "@babel/core";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

export type XrayTransformOptions = {
  routeId: string;
  routePath: string;
  dev?: boolean;
};

const XRAY_IMPORT_SOURCE = "react-router-xray/react";
const XRAY_BOUNDARY = "XrayBoundary";

export function xrayBabelPlugin(options: XrayTransformOptions): PluginObj {
  return {
    name: "react-router-xray-instrument-route",
    visitor: {
      Program(path) {
        if (!shouldTransform(options)) return;
        let didWrap = false;

        path.traverse({
          ExportDefaultDeclaration(exportPath) {
            if (didWrap) return;
            const declaration = exportPath.node.declaration;
            const wrapped = wrapDefaultExportComponent(exportPath, declaration, options);
            didWrap = didWrap || wrapped;
          }
        });

        if (didWrap) {
          ensureXrayImport(path);
        }
      }
    }
  };
}

export function transformRouteComponent(
  source: string,
  options: XrayTransformOptions
): string {
  const result = transformSync(source, {
    filename: "route.tsx",
    parserOpts: { sourceType: "module", plugins: ["typescript", "jsx"] },
    generatorOpts: { retainLines: false, compact: false },
    plugins: [xrayBabelPlugin(options)]
  });
  return result?.code ?? source;
}

function shouldTransform(options: XrayTransformOptions): boolean {
  if (options.dev === false) return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function wrapDefaultExportComponent(
  exportPath: any,
  declaration: t.Declaration | t.Expression,
  options: XrayTransformOptions
): boolean {
  if (t.isFunctionDeclaration(declaration)) {
    if (!isNamedReactComponent(declaration.id?.name) || !returnsJsx(declaration) || isAlreadyWrapped(declaration.body)) {
      return false;
    }
    wrapFunctionBodyReturns(declaration.body, options);
    return true;
  }

  if (t.isIdentifier(declaration)) {
    const binding = exportPath.scope.getBinding(declaration.name);
    const bindingNode = binding?.path.node;
    if (!bindingNode) return false;
    if (t.isFunctionDeclaration(bindingNode)) {
      if (!isNamedReactComponent(bindingNode.id?.name) || !returnsJsx(bindingNode) || isAlreadyWrapped(bindingNode.body)) {
        return false;
      }
      wrapFunctionBodyReturns(bindingNode.body, options);
      return true;
    }
    if (t.isVariableDeclarator(bindingNode) && bindingNode.init) {
      return wrapExpressionComponent(bindingNode.id, bindingNode.init, options);
    }
    return false;
  }

  if (t.isArrowFunctionExpression(declaration) || t.isFunctionExpression(declaration)) {
    const syntheticId = t.identifier("DefaultExportComponent");
    return wrapExpressionComponent(syntheticId, declaration, options);
  }

  if (t.isCallExpression(declaration) && isForwardRefCall(declaration)) {
    return wrapForwardRefInner(declaration, options);
  }

  return false;
}

function wrapExpressionComponent(id: t.LVal, expr: t.Expression, options: XrayTransformOptions): boolean {
  const name = t.isIdentifier(id) ? id.name : "";
  if (!isNamedReactComponent(name)) return false;

  if (t.isArrowFunctionExpression(expr)) {
    if (!returnsJsx(expr) || isAlreadyWrappedArrow(expr)) return false;
    wrapArrow(expr, options);
    return true;
  }
  if (t.isFunctionExpression(expr)) {
    if (!returnsJsx(expr) || isAlreadyWrapped(expr.body)) return false;
    wrapFunctionBodyReturns(expr.body, options);
    return true;
  }
  if (t.isCallExpression(expr) && isForwardRefCall(expr)) {
    return wrapForwardRefInner(expr, options);
  }
  return false;
}

function wrapForwardRefInner(call: t.CallExpression, options: XrayTransformOptions): boolean {
  const first = call.arguments[0];
  if (!first || !t.isExpression(first)) return false;

  if (t.isFunctionExpression(first) || t.isArrowFunctionExpression(first)) {
    if (!returnsJsx(first)) return false;
    if (t.isFunctionExpression(first)) {
      if (isAlreadyWrapped(first.body)) return false;
      wrapFunctionBodyReturns(first.body, options);
    } else {
      if (isAlreadyWrappedArrow(first)) return false;
      wrapArrow(first, options);
    }
    return true;
  }
  return false;
}

function wrapArrow(fn: t.ArrowFunctionExpression, options: XrayTransformOptions): void {
  if (t.isJSXElement(fn.body) || t.isJSXFragment(fn.body)) {
    fn.body = createBoundaryJsx(fn.body, options);
    return;
  }
  if (t.isBlockStatement(fn.body)) {
    wrapFunctionBodyReturns(fn.body, options);
  }
}

function wrapFunctionBodyReturns(body: t.BlockStatement, options: XrayTransformOptions): void {
  for (const stmt of body.body) {
    if (!t.isReturnStatement(stmt) || !stmt.argument) continue;
    if (t.isJSXElement(stmt.argument) || t.isJSXFragment(stmt.argument)) {
      if (isBoundaryElement(stmt.argument)) continue;
      stmt.argument = createBoundaryJsx(stmt.argument, options);
    }
  }
}

function createBoundaryJsx(inner: t.JSXElement | t.JSXFragment, options: XrayTransformOptions): t.JSXElement {
  return t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier(XRAY_BOUNDARY),
      [
        t.jsxAttribute(t.jsxIdentifier("routeId"), t.stringLiteral(options.routeId)),
        t.jsxAttribute(t.jsxIdentifier("routePath"), t.stringLiteral(options.routePath))
      ],
      false
    ),
    t.jsxClosingElement(t.jsxIdentifier(XRAY_BOUNDARY)),
    [t.jsxExpressionContainer(inner)],
    false
  );
}

function ensureXrayImport(programPath: any): void {
  let hasNamedImport = false;
  let existingImport: t.ImportDeclaration | null = null;

  for (const stmt of programPath.node.body) {
    if (!t.isImportDeclaration(stmt)) continue;
    if (stmt.source.value !== XRAY_IMPORT_SOURCE) continue;
    existingImport = stmt;
    if (stmt.specifiers.some((spec) => t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: XRAY_BOUNDARY }))) {
      hasNamedImport = true;
      break;
    }
  }

  if (hasNamedImport) return;
  if (existingImport) {
    existingImport.specifiers.push(
      t.importSpecifier(t.identifier(XRAY_BOUNDARY), t.identifier(XRAY_BOUNDARY))
    );
    return;
  }

  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier(XRAY_BOUNDARY), t.identifier(XRAY_BOUNDARY))],
    t.stringLiteral(XRAY_IMPORT_SOURCE)
  );
  programPath.node.body.unshift(importDecl);
}

function isNamedReactComponent(name?: string | null): boolean {
  return Boolean(name && /^[A-Z]/.test(name));
}

function returnsJsx(fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression): boolean {
  let found = false;
  traverse(
    t.file(t.program([t.expressionStatement(t.toExpression(fn as any))])),
    {
      ReturnStatement(path) {
        if (!path.node.argument) return;
        if (t.isJSXElement(path.node.argument) || t.isJSXFragment(path.node.argument)) {
          found = true;
          path.stop();
        }
      },
      JSXElement(path) {
        found = true;
        path.stop();
      },
      JSXFragment(path) {
        found = true;
        path.stop();
      }
    },
    undefined,
    undefined
  );
  return found;
}

function isAlreadyWrapped(block: t.BlockStatement): boolean {
  return block.body.some((stmt) => {
    if (!t.isReturnStatement(stmt) || !stmt.argument) return false;
    return isBoundaryElement(stmt.argument);
  });
}

function isAlreadyWrappedArrow(fn: t.ArrowFunctionExpression): boolean {
  if (t.isJSXElement(fn.body)) return isBoundaryElement(fn.body);
  if (t.isBlockStatement(fn.body)) return isAlreadyWrapped(fn.body);
  return false;
}

function isBoundaryElement(node: t.Node): boolean {
  if (!t.isJSXElement(node)) return false;
  return t.isJSXIdentifier(node.openingElement.name, { name: XRAY_BOUNDARY });
}

function isForwardRefCall(expr: t.CallExpression): boolean {
  if (t.isIdentifier(expr.callee, { name: "forwardRef" })) return true;
  if (t.isMemberExpression(expr.callee)) {
    return (
      t.isIdentifier(expr.callee.object, { name: "React" }) &&
      t.isIdentifier(expr.callee.property, { name: "forwardRef" })
    );
  }
  return false;
}
