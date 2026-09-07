import type { Metadata } from "next";
import DemoClient from "./demo-client";

export const metadata: Metadata = { title: "Demo Interaktif KAEL", robots: { index: false, follow: false } };

export default function PenawaranDemoPage() {
  return <DemoClient />;
}
