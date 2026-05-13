import { useEffect } from "react";
import { Navbar } from "../components/home/Navbar";
import { Hero } from "../components/home/Hero";
import { HowItWorks } from "../components/home/HowItWorks";
import { Examples } from "../components/home/Examples";
import { Features } from "../components/home/Features";
import { CallToAction } from "../components/home/CallToAction";
import { Footer } from "../components/home/Footer";

export function HomePage() {
  useEffect(() => {
    document.title = "reactimate — Hero Animator for React";
  }, []);

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Examples />
        <Features />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
