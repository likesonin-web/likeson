"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function BackButton({ 
  label = "Go Back", 
  className = "" 
}) {
  const router = useRouter();

  return (
    <motion.button
      onClick={() => router.back()}
      // Framer Motion properties replacing Tailwind's hover transform
      whileHover={{ x: -4 }} 
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`
        hover:text-primary border border-base-200 p-1 flex gap-3 text-base-content 
        hover:bg-base-200 transition-colors
        ${className}
      `}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-xs">{label}</span>
    </motion.button>
  );
}