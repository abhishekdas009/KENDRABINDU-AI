"use client";

import { motion } from "framer-motion";
import DirectApplicationForm from "@/components/DirectApplicationForm";

export default function Home() {
  return (
    <div className="send-page">
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
