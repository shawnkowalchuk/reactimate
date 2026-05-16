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
            color: "#fafafa",
          }}
        >{"Sprinkle"}</span>
        {" "}
        <motion.span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: -1,
            display: "inline-block",
            color: "#fbbf24",
          }}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 3, ease: "easeOut" }}
        >{"magic."}</motion.span>
      </div>
    </div>
  );
}
