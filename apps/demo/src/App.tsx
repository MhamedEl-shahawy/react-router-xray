import { Link, Route, Routes } from "react-router-dom";
import { RouteXrayOverlay } from "../../../packages/react/src/index";

function Page({ title }: { title: string }) {
  return <h2>{title}</h2>;
}

export default function App() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h1>React Router Xray Demo</h1>
      <nav style={{ display: "flex", gap: 8 }}>
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Page title="Home" />} />
        <Route path="/dashboard" element={<Page title="Dashboard" />} />
        <Route path="/settings" element={<Page title="Settings" />} />
      </Routes>
      <RouteXrayOverlay />
    </main>
  );
}
