import { AnimatedText } from "./components/AnimatedText";

export function App() {
  return (
    <main className="app">
      <h1>reactimate</h1>
      <p className="tagline">A website tool to animate text with React.</p>
      <section className="demo">
        <AnimatedText text="Hello, animated world." />
      </section>
    </main>
  );
}
