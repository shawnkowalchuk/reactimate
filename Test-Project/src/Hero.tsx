import { motion } from "motion/react";

export function Hero() {
  return (
    <div style={{
        width: 1200,
        height: 675,
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#fafafa",
        fontSize: 72,
        fontWeight: 700,
      }}>
      <div style={{
          textAlign: "center",
          lineHeight: 1.1,
          whiteSpace: "pre-wrap",
        }}>
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: -1,
            display: "inline-block",
            color: "#f87171",
          }}
        >{"Celebrate!"}</span>
        {"\n"}
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: 0,
            display: "inline-block",
            color: "#fafafa",
          }}
        >{"This is how it works/"}</span>
      </div>
      {/* Particle effect fx_xzUqeTdzSy mode="hover" — only "area" mode is
          currently exportable. Other modes track the cursor and need a
          runtime listener; skipped. */}
    </div>
  );
}
