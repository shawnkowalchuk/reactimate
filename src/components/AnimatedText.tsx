interface AnimatedTextProps {
  text: string;
  staggerMs?: number;
}

export function AnimatedText({ text, staggerMs = 40 }: AnimatedTextProps) {
  return (
    <span aria-label={text} role="text" className="animated-text">
      {Array.from(text).map((char, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="animated-text__char"
          style={{ animationDelay: `${i * staggerMs}ms` }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}
