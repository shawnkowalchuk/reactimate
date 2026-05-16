import { Hero } from "./Hero";

/**
 * Pretend-real landing page. The <Hero /> component below is the
 * placeholder you'll REPLACE with whatever you export from the
 * reactimate editor. Drop the exported file into src/Hero.tsx and
 * refresh — your animation should play in the page below.
 */
export function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <nav
        style={{
          width: "100%",
          padding: "16px 24px",
          borderBottom: "1px solid #262626",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 14,
        }}
      >
        <strong>test-app</strong>
        <span style={{ color: "#737373" }}>Reactimate sandbox</span>
      </nav>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 1200,
          padding: "80px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Hero />
      </main>

      <footer
        style={{
          width: "100%",
          padding: "24px",
          textAlign: "center",
          color: "#525252",
          fontSize: 12,
        }}
      >
        Replace <code>src/Hero.tsx</code> with the file you exported from reactimate.
      </footer>
    </div>
  );
}
