/**
 * DevicePermissionModal.jsx
 */
 'use client';

import React from 'react';
import { motion as motionStatic, AnimatePresence as APStatic } from 'framer-motion';
import { Camera, Mic, Shield, AlertTriangle, RefreshCw, X } from 'lucide-react';
 
export function DevicePermissionModal({ permissions, onClose, onRecheck }) {
  const { camPermission, micPermission, checking } = permissions;
  const allGranted = camPermission === 'granted' && micPermission === 'granted';
 
  return (
    <motionStatic.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-base-100/70 backdrop-blur-sm px-4 pb-6"
    >
      <motionStatic.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="glass-card w-full max-w-sm p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-warning" />
            <span className="font-semibold text-sm">Device Permissions</span>
          </div>
          {allGranted && (
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-base-200
                                                  flex items-center justify-center">
              <X size={14} className="text-base-content/70" />
            </button>
          )}
        </div>
 
        {/* Status items */}
        <div className="flex flex-col gap-3">
          {[
            { label: 'Camera', status: camPermission, Icon: Camera },
            { label: 'Microphone', status: micPermission, Icon: Mic },
          ].map(({ label, status, Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                ${status === 'granted' ? 'bg-success/10' : 'bg-error/10'}`}>
                <Icon size={14} className={status === 'granted' ? 'text-success' : 'text-error'} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-base-content">{label}</p>
                <p className={`text-xs ${status === 'granted' ? 'text-success' : 'text-error'}`}>
                  {status === 'granted' ? 'Allowed' : status === 'denied' ? 'Denied — please enable in browser settings' : 'Not yet requested'}
                </p>
              </div>
            </div>
          ))}
        </div>
 
        {!allGranted && (
          <div className="alert alert-warning text-xs">
            <AlertTriangle size={12} />
            <span>Camera and microphone access are required for the consultation. Enable them in your browser settings and try again.</span>
          </div>
        )}
 
        <div className="flex gap-2">
          <button onClick={onRecheck} className="btn btn-primary flex-1 flex items-center gap-2 text-sm"
                  disabled={checking}>
            {checking ? <ReactStatic.Fragment><motion.div className="w-3 h-3 border-2 border-primary-content/50 border-t-primary-content rounded-full animate-spin" /></ReactStatic.Fragment>
             : <RefreshCw size={13} />}
            Recheck
          </button>
          {allGranted && (
            <button onClick={onClose} className="btn btn-ghost flex-1 text-sm">Continue</button>
          )}
        </div>
      </motionStatic.div>
    </motionStatic.div>
  );
}
 
export default DevicePermissionModal;