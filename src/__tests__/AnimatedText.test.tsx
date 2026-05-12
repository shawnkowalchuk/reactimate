import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnimatedText } from "../components/AnimatedText";

describe("AnimatedText", () => {
  it("renders one span per character", () => {
    const { container } = render(<AnimatedText text="hi" />);
    expect(container.querySelectorAll(".animated-text__char")).toHaveLength(2);
  });

  it("applies staggered animation delay per character", () => {
    const { container } = render(
      <AnimatedText text="abc" staggerMs={100} />,
    );
    const chars = container.querySelectorAll<HTMLElement>(
      ".animated-text__char",
    );
    expect(chars[0].style.animationDelay).toBe("0ms");
    expect(chars[1].style.animationDelay).toBe("100ms");
    expect(chars[2].style.animationDelay).toBe("200ms");
  });

  it("exposes the full text to assistive tech via aria-label", () => {
    render(<AnimatedText text="Hello world" />);
    expect(screen.getByLabelText("Hello world")).toBeInTheDocument();
  });
});
