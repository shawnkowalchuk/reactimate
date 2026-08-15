import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "../components/home/Navbar";
import { Hero } from "../components/home/Hero";
import { HowItWorks } from "../components/home/HowItWorks";
import { Examples } from "../components/home/Examples";
import { Integration } from "../components/home/Integration";
import { Features } from "../components/home/Features";
import { FAQ } from "../components/home/FAQ";
import { CallToAction } from "../components/home/CallToAction";
import { Footer } from "../components/home/Footer";

export function HomePage() {
  const location = useLocation();

  useEffect(() => {
    document.title = "reactimate — Hero Animator for React";
  }, []);

  // Cross-route anchor navigation: when the user clicks `/#examples` from
  // another route, react-router lands here with `location.hash` set. We
  // scroll the matching section into view once the page paints.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    // Defer to next frame so the section has actually mounted/laid out.
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash]);

  return (
    // Desktop keeps the app-shell feel: a fixed-height frame with only <main>
    // scrolling, so the footer is always parked at the bottom. That costs a
    // phone ~156px of an ~844px screen for links nobody scrolls to on purpose,
    // so below md: the frame grows with its content and the whole document
    // scrolls, handing those pixels back to the page. The sticky navbar keeps
    // navigation reachable either way.
    <div className="flex min-h-screen flex-col bg-white text-neutral-900 md:h-screen dark:bg-neutral-950 dark:text-neutral-100">
      <Navbar />
      <main className="flex-1 md:overflow-y-auto">
        <Hero />
        <HowItWorks />
        <Examples />
        <Integration />
        <Features />
        <FAQ />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
