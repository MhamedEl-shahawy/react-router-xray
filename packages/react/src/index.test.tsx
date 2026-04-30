import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RouteXrayOverlay, XrayBoundary } from "./index";

vi.mock("@react-router-xray/core/wasm", () => ({
  init: vi.fn(async () => undefined),
  analyzeRoutes: vi.fn(async () => ({ score: 72, routes: ["/", "/users", "/users/:id"] })),
  parsePattern: vi.fn(async (pattern: string) => ({
    raw: pattern,
    segments: pattern.split("/").filter(Boolean),
    dynamic_params: pattern.includes(":id") ? ["id"] : [],
    has_wildcard: false
  }))
}));

function renderApp(initial = "/users/42") {
  const Root = () => (
    <XrayBoundary routeId="root">
      <Outlet />
      <RouteXrayOverlay />
    </XrayBoundary>
  );
  const Users = () => (
    <XrayBoundary routeId="users">
      <Outlet />
    </XrayBoundary>
  );
  const UserDetail = () => <XrayBoundary routeId="user-detail"><div>detail</div></XrayBoundary>;

  const router = createMemoryRouter(
    [
      {
        id: "root",
        path: "/",
        element: <Root />,
        handle: { xray: { component: "RootLayout", errorBoundary: true } },
        children: [
          {
            id: "users",
            path: "users",
            element: <Users />,
            handle: { xray: { component: "UsersList", lazy: true } },
            children: [
              {
                id: "user-detail",
                path: ":id",
                element: <UserDetail />,
                handle: { xray: { component: "UserDetail", lazy: true, errorBoundary: true } }
              }
            ]
          }
        ]
      }
    ],
    { initialEntries: [initial] }
  );

  return render(<RouterProvider router={router} />);
}

describe("RouteXrayOverlay", () => {
  it("renders active chain and score", async () => {
    renderApp();
    expect(screen.getAllByTestId("xray-overlay").length).toBeGreaterThan(0);
    expect(screen.getByText("ACTIVE CHAIN")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/72\/100/)).toBeInTheDocument());
  });

  it("toggles with Alt+R and closes with Escape", async () => {
    renderApp();
    expect(screen.getAllByTestId("xray-overlay").length).toBeGreaterThan(0);
    fireEvent.keyDown(window, { key: "r", altKey: true });
    await waitFor(() => expect(screen.queryAllByTestId("xray-overlay").length).toBe(0));
    fireEvent.keyDown(window, { key: "r", altKey: true });
    await waitFor(() => expect(screen.getAllByTestId("xray-overlay").length).toBeGreaterThan(0));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryAllByTestId("xray-overlay").length).toBe(0));
  });

  it("highlights instrumented DOM node on hover", async () => {
    renderApp();
    const routeRows = await screen.findAllByText(/\/users\/42/, { selector: ".xray-route-row span" });
    const rowLabel = routeRows[0];
    fireEvent.mouseEnter(rowLabel.closest(".xray-route-row")!);
    const node = document.querySelector('[data-xray-route-id="user-detail"]');
    expect(node).toHaveAttribute("data-xray-hovered", "true");
    fireEvent.mouseLeave(rowLabel.closest(".xray-route-row")!);
    expect(node).not.toHaveAttribute("data-xray-hovered");
  });
});
