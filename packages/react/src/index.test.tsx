import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RouteXrayOverlay, XrayBoundary } from "./index";

vi.mock("react-router-xray-core/wasm", () => ({
  init: vi.fn(async () => undefined),
  analyzeRoutes: vi.fn(async () => ({
    score: 72,
    routes: ["/", "/users", "/users/:id"],
    insights: ["Mock: replace with real analyzeRoutes in integration tests."],
    metrics: {
      routePathsAnalyzed: 3,
      maxPathDepth: 3,
      dynamicParamsTotal: 1,
      wildcardsTotal: 0,
      clarityScore: 72,
      structuralPenalty: 28,
      tier: "moderate" as const,
      headline:
        "Some structural weight from segment depth, params, or layout breadth—still healthy for many apps.",
      contributors: [
        {
          id: "chain",
          label: "Matched chain",
          penaltyPoints: 10,
          detail: "3 pathname rows (layouts + leaf). Each extra row adds +5 points—more ancestors mean more boundaries and context switching.",
        },
        {
          id: "depth",
          label: "URL segment depth",
          penaltyPoints: 10,
          detail: "Deepest pathname uses 3 segment(s). Beyond depth 1 adds +10 per extra segment.",
        },
        {
          id: "dynamic",
          label: "Dynamic params (:id)",
          penaltyPoints: 8,
          detail: "1 dynamic segment(s); each adds +8—ensure loaders validate input.",
        },
        {
          id: "wildcard",
          label: "Wildcards (*)",
          penaltyPoints: 0,
          detail: "No wildcard markers.",
        },
      ],
    },
  })),
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
  it("renders active chain and clarity score after opening", async () => {
    renderApp();
    expect(screen.queryByTestId("xray-overlay")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open route x-ray/i }));
    await waitFor(() => expect(screen.getByTestId("xray-overlay")).toBeInTheDocument());
    expect(screen.getByText("ACTIVE CHAIN")).toBeInTheDocument();
    expect(screen.getByText("STRUCTURAL CLARITY")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText(/structural clarity score/i)).toHaveTextContent(/72/)
    );
  });

  it("toggles with Alt+R and closes with Escape", async () => {
    renderApp();
    expect(screen.queryByTestId("xray-overlay")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { code: "KeyR", altKey: true });
    await waitFor(() => expect(screen.getByTestId("xray-overlay")).toBeInTheDocument());
    fireEvent.keyDown(window, { code: "KeyR", altKey: true });
    await waitFor(() => expect(screen.queryByTestId("xray-overlay")).not.toBeInTheDocument());
    fireEvent.keyDown(window, { code: "KeyR", altKey: true });
    await waitFor(() => expect(screen.getByTestId("xray-overlay")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("xray-overlay")).not.toBeInTheDocument());
  });

  it("highlights instrumented DOM node on hover", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /open route x-ray/i }));
    await waitFor(() => expect(screen.getByTestId("xray-overlay")).toBeInTheDocument());
    const routeRows = await screen.findAllByText(/\/users\/42/, { selector: ".xray-route-row span" });
    const rowLabel = routeRows[0];
    fireEvent.mouseEnter(rowLabel.closest(".xray-route-row")!);
    const node = document.querySelector('[data-xray-route-id="user-detail"]');
    expect(node).toHaveAttribute("data-xray-hovered", "true");
    fireEvent.mouseLeave(rowLabel.closest(".xray-route-row")!);
    expect(node).not.toHaveAttribute("data-xray-hovered");
  });
});
