import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { RouteXrayOverlay, type RouteXrayOverlayProps, XrayBoundary } from "./index";

function BaseApp({ overlayProps }: { overlayProps?: RouteXrayOverlayProps }) {
  return (
    <XrayBoundary routeId="root">
      <Outlet />
      <RouteXrayOverlay {...overlayProps} />
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

function AppWithOverlay({
  collapsed = false,
  overlayProps
}: {
  collapsed?: boolean;
  overlayProps?: RouteXrayOverlayProps;
}) {
  const router = createMemoryRouter(
    [{
      id: "root",
      path: "/",
      element: <BaseApp overlayProps={overlayProps} />,
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
    if (!collapsed) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('[aria-label="Minimize panel"]')?.click();
    });
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
  render: () => <AppWithOverlay overlayProps={{ defaultOpen: true }} />
};

export const LoadingState: Story = {
  name: "loading state",
  render: () => <AppWithOverlay overlayProps={{ defaultOpen: true }} />
};

export const ErrorState: Story = {
  name: "error state",
  render: () => <AppWithOverlay overlayProps={{ defaultOpen: true }} />
};

export const Collapsed: Story = {
  render: () => <AppWithOverlay collapsed overlayProps={{ defaultOpen: true }} />
};
