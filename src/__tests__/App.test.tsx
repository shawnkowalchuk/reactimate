import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App", () => {
  it("renders the title", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /reactimate/i }),
    ).toBeInTheDocument();
  });

  it("renders the animated demo text", () => {
    render(<App />);
    expect(screen.getByLabelText("Hello, animated world.")).toBeInTheDocument();
  });
});
