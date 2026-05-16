import { motion } from "motion/react";

/**
 * Placeholder Hero. Delete this file and replace it with the
 * <slug>.jsx (or .tsx) file you exported from the reactimate editor.
 * Default export name should be `Hero`.
 */
export function Hero() {
  return (
    <h1
      style={{
        fontSize: 72,
        fontWeight: 800,
        letterSpacing: -1,
        textAlign: "center",
        margin: 0,
      }}
    >
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >
        Drop your exported Hero.jsx here →
      </motion.span>
    </h1>
  );
}
