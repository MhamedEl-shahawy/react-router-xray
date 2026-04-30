import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";
import { transformRouteComponent } from "./babel-transform";

const opts = { routeId: "users-userid", routePath: "/users/:userId", dev: true };

function transformAst(source: string) {
  return parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"]
  });
}

describe("xray babel transform", () => {
  it("wraps default function declaration component", () => {
    const source = `
      export default function UserDetail() {
        return <div>content</div>;
      }
    `;
    const output = transformRouteComponent(source, opts);
    expect(output).toContain("import { XrayBoundary } from \"react-router-xray/react\";");
    expect(output).toContain("<XrayBoundary routeId=\"users-userid\" routePath=\"/users/:userId\">");
    expect(output).toContain("UserDetail");
  });

  it("wraps identifier-based default arrow function", () => {
    const source = `
      const UserDetail = () => <section>ok</section>;
      export default UserDetail;
    `;
    const output = transformRouteComponent(source, opts);
    expect(output).toContain("const UserDetail = () => <XrayBoundary");
    expect(output).toContain("export default UserDetail;");
  });

  it("wraps forwardRef default export", () => {
    const source = `
      export default React.forwardRef(function UserDetail(props, ref) {
        return <main ref={ref}>{props.children}</main>;
      });
    `;
    const output = transformRouteComponent(source, opts);
    expect(output).toContain("React.forwardRef(function UserDetail");
    expect(output).toContain("<XrayBoundary routeId=\"users-userid\" routePath=\"/users/:userId\">");
  });

  it("is idempotent when already wrapped", () => {
    const source = `
      import { XrayBoundary } from "react-router-xray/react";
      export default function UserDetail() {
        return <XrayBoundary routeId="users-userid" routePath="/users/:userId"><div /></XrayBoundary>;
      }
    `;
    const output = transformRouteComponent(source, opts);
    const count = (output.match(/XrayBoundary/g) ?? []).length;
    expect(count).toBe(3);
  });

  it("snapshot: function declaration AST", () => {
    const output = transformRouteComponent(
      `export default function UserDetail(){ return <div /> }`,
      opts
    );
    expect(transformAst(output)).toMatchSnapshot();
  });

  it("snapshot: arrow function AST", () => {
    const output = transformRouteComponent(
      `const UserDetail = () => <div />; export default UserDetail;`,
      opts
    );
    expect(transformAst(output)).toMatchSnapshot();
  });

  it("snapshot: forwardRef AST", () => {
    const output = transformRouteComponent(
      `export default forwardRef(function UserDetail(){ return <div />; });`,
      opts
    );
    expect(transformAst(output)).toMatchSnapshot();
  });
});
