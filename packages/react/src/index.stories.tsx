import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { RouteXrayOverlay, XrayBoundary } from "./index";

function BaseApp() {
  return (
    <XrayBoundary routeId="root">
      <Outlet />
      <RouteXrayOverlay />
    </XrayBoundary>
  );
}

function Users() {
  return (
    <XrayBoundary routeId="users">
      <Outlet />
    </XrayBoundary>
  );
}

function Detail() {
  return <XrayBoundary routeId="user-detail"><div>User detail page</div></XrayBoundary>;
}

function AppWithOverlay({ collapsed = false }: { collapsed?: boolean }) {
  const router = createMemoryRouter(
    [{
      id: "root",
      path: "/",
      element: <BaseApp />,
      handle: { xray: { component: "RootLayout", errorBoundary: true } },
      children: [{
        id: "users",
        path: "users",
        element: <Users />,
        handle: { xray: { component: "UsersList", lazy: true } },
        children: [{
          id: "user-detail",
          path: ":id",
          element: <Detail />,
          handle: { xray: { component: "UserDetail", lazy: true, errorBoundary: true } }
        }]
      }]
    }],
    { initialEntries: ["/users/42"] }
  );

  useEffect(() => {
    if (collapsed) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", altKey: true }));
    }
  }, [collapsed]);

  return <RouterProvider router={router} />;
}

const meta = {
  title: "RouteXray/Overlay",
  component: AppWithOverlay
} satisfies Meta<typeof AppWithOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AppWithOverlay />
};

export const LoadingState: Story = {
  name: "loading state",
  render: () => <AppWithOverlay />
};

export const ErrorState: Story = {
  name: "error state",
  render: () => <AppWithOverlay />
};

export const Collapsed: Story = {
  render: () => <AppWithOverlay collapsed />
};
