"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, MoreHorizontal, UserPlus, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
const UserManagement = () => {
  // Mock Data - In production, fetch this from your API
  const users = [
    { id: 1, name: "Dr. Sarah Smith", email: "sarah@likeson.in", role: "Doctor", status: "Active" },
    { id: 2, name: "John Doe", email: "john@gmail.com", role: "Customer", status: "Active" },
    { id: 3, name: "Lab Tech Pro", email: "lab@likeson.in", role: "Lab Partner", status: "Pending" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-darktext uppercase">User Management</h3>
          <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase">Manage access and roles</p>
        </div>
        <Button className="bg-likeson-primary hover:bg-likeson-primary/90 rounded-2xl h-12 px-6 gap-2">
          <UserPlus size={18} />
          <span className="font-bold text-xs uppercase tracking-wider">Add New User</span>
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-border/50 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, email, or role..." className="pl-11 h-12 rounded-xl bg-likeson-light-blue/30 border-none focus-visible:ring-likeson-primary/20" />
        </div>
        <Button variant="outline" className="h-12 rounded-xl gap-2 border-border/60">
          <Filter size={16} /> Filter
        </Button>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-black/[0.02] border border-border/40 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-likeson-light-blue/10 border-b border-border/40">
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">User Details</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-likeson-light-blue/5 transition-colors group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-likeson-primary/10 flex items-center justify-center font-bold text-likeson-primary">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-darktext">{user.name}</p>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <Mail size={12} /> {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-6 text-sm font-bold text-darktext">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-likeson-primary" />
                    {user.role}
                  </div>
                </td>
                <td className="p-6 text-sm">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    user.status === "Active" ? "bg-lightgreen/20 text-green-700" : "bg-orange/20 text-orange"
                  )}>
                    {user.status}
                  </span>
                </td>
                <td className="p-6 text-right">
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-likeson-primary/10">
                    <MoreHorizontal size={18} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default UserManagement;