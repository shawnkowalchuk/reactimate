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
    <div className="h-screen flex flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
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
