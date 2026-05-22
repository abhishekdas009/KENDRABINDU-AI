"use client";

import { motion } from "framer-motion";
import DirectApplicationForm from "@/components/DirectApplicationForm";

export default function Home() {
  return (
    <div className="send-page">
      <div className="page-title">
        <h1>
          AI Application Engine
        </h1>
        <p>
          Queue multiple applications, tailor cover letters with optional job descriptions, and keep the composer open.
        </p>
      </div>

      <motion.div
        className="send-page-shell"
        layout
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <DirectApplicationForm />
      </motion.div>
    </div>
  );
}
