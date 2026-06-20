/**
 * components/chat/EmptyState.jsx
 * Shown when no conversation is active.
 */
"use client";

import React from "react";
import { motion } from "framer-motion";
import { MessageSquare, Users, ArrowLeft } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "@/store/slices/userSlice";

const ROLE_MESSAGES = {
  superadmin:       { title: "All conversations at your command.", sub: "Monitor any chat across the platform." },
  admin:            { title: "Manage platform conversations.", sub: "Select a chat or start a new one." },
  doctor:           { title: "Connect with patients & teams.", sub: "View consultation chats or start a new conversation." },
  hospital:         { title: "Hospital communication hub.", sub: "Coordinate with doctors, staff, and patients." },
  customer:         { title: "Your messages, one place.", sub: "Chat with doctors, track orders, or get support." },
  pharmacy:         { title: "Pharmacy communications.", sub: "Coordinate orders and customer queries here." },
  lab_partner:      { title: "Lab communications.", sub: "Discuss test results and coordinate pickups." },
  blood_bank:       { title: "Blood bank coordination.", sub: "Respond to urgent requests and coordinate deliveries." },
  driver:           { title: "Stay connected on the road.", sub: "View delivery and customer chats here." },
  solodriverpartner:{ title: "Driver communications.", sub: "Coordinate pickups and stay updated." },
  transportpartner: { title: "Fleet communications.", sub: "Manage driver and customer chats." },
  care_assistant:   { title: "Care coordination.", sub: "Connect with patients and medical teams." },
  finance:          { title: "Finance view.", sub: "Review order-related conversations (read-only)." },
};

export default function EmptyState({ onNewChat, totalUnread }) {
  const currentUser = useSelector(selectCurrentUser);
  const role = currentUser?.role || "customer";
  const msg = ROLE_MESSAGES[role] || ROLE_MESSAGES.customer;

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full w-full bg-base-100 p-6 text-center"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <MessageSquare size={48} />
      </motion.div>

      <h2 className="font-montserrat text-2xl md:text-3xl font-bold text-base-content mb-3 tracking-tight">
        {msg.title}
      </h2>
      <p className="font-poppins text-base md:text-lg text-base-content/60 max-w-md">
        {msg.sub}
      </p>

      {totalUnread > 0 && (
        <motion.div
          className="flex items-center gap-3 mt-6 px-5 py-3 bg-base-200 rounded-[var(--r-field)] border border-base-300 shadow-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-primary text-primary-content text-sm font-bold font-poppins">
            {totalUnread}
          </span>
          <span className="font-poppins text-sm font-medium text-base-content">
            unread message{totalUnread !== 1 ? "s" : ""} waiting
          </span>
        </motion.div>
      )}

      {!["finance"].includes(role) && (
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
          <button className="btn btn-primary font-poppins" onClick={() => onNewChat("direct")}>
            <MessageSquare size={18} /> New Message
          </button>
          {!["driver", "solodriverpartner", "transportpartner"].includes(role) && (
            <button className="btn btn-outline font-poppins" onClick={() => onNewChat("group")}>
              <Users size={18} /> New Group
            </button>
          )}
        </div>
      )}

      <p className="hidden md:flex items-center gap-2 mt-12 text-sm font-poppins text-base-content/40">
        <ArrowLeft size={16} /> Select a conversation from the left panel
      </p>
    </motion.div>
  );
}