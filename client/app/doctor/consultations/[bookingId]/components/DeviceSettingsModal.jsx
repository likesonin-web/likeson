'use client';
/**
 * DeviceSettingsModal.jsx
 * Camera, microphone, speaker selection with noise suppression toggle.
 */

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Camera, Mic, Volume2, X, AlertTriangle } from 'lucide-react';

/**
 * @param {object}    props
 * @param {boolean}   props.isOpen
 * @param {Function}  props.onClose
 * @param {Array}     props.cameras
 * @param {Array}     props.microphones
 * @param {Array}     props.speakers
 * @param {string}    props.selectedCamera
 * @param {string}    props.selectedMic
 * @param {string}    props.selectedSpeaker
 * @param {Function}  props.onCameraChange
 * @param {Function}  props.onMicChange
 * @param {Function}  props.onSpeakerChange
 * @param {boolean}   props.noiseSuppression
 * @param {Function}  props.onToggleNoiseSuppression
 * @param {string|null} props.permError
 */
export const DeviceSettingsModal = memo(function DeviceSettingsModal({
  isOpen,
  onClose,
  cameras = [], microphones = [], speakers = [],
  selectedCamera, selectedMic, selectedSpeaker,
  onCameraChange, onMicChange, onSpeakerChange,
  noiseSuppression = false,
  onToggleNoiseSuppression,
  permError,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="device-settings-title"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-card w-full max-w-sm shadow-depth-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-base-300">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-primary" />
                <h2 id="device-settings-title" className="text-sm font-bold">Device Settings</h2>
              </div>
              <button onClick={onClose} aria-label="Close settings" className="btn btn-ghost btn-xs btn-circle">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {permError && (
                <div className="alert alert-error text-xs">
                  <AlertTriangle size={14} />
                  <span>{permError}</span>
                </div>
              )}

              {/* Camera */}
              <DeviceSelect
                icon={Camera}
                label="Camera"
                devices={cameras}
                value={selectedCamera}
                onChange={onCameraChange}
              />

              {/* Microphone */}
              <DeviceSelect
                icon={Mic}
                label="Microphone"
                devices={microphones}
                value={selectedMic}
                onChange={onMicChange}
              />

              {/* Speaker */}
              <DeviceSelect
                icon={Volume2}
                label="Speaker"
                devices={speakers}
                value={selectedSpeaker}
                onChange={onSpeakerChange}
              />

              {/* Noise suppression toggle */}
              <div className="flex items-center justify-between p-3 bg-base-200 rounded-xl border border-base-300">
                <div className="flex items-center gap-2">
                  <Mic size={14} className="text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Noise Suppression</p>
                    <p className="text-[10px] text-base-content/50">Reduce background noise</p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={noiseSuppression}
                  onClick={onToggleNoiseSuppression}
                  className={`
                    relative w-10 h-5 rounded-full transition-colors border
                    ${noiseSuppression ? 'bg-primary border-primary' : 'bg-base-300 border-base-300'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${noiseSuppression ? 'translate-x-5' : 'translate-x-0.5'}
                    `}
                  />
                </button>
              </div>
            </div>

            <div className="p-4 pt-0">
              <button onClick={onClose} className="btn btn-primary w-full btn-sm">
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

function DeviceSelect({ icon: Icon, label, devices, value, onChange }) {
  return (
    <div>
      <label className="label mb-1">
        <span className="flex items-center gap-1.5 label-text">
          <Icon size={12} className="text-primary" />
          {label}
        </span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="input-field text-xs py-2"
        disabled={devices.length === 0}
      >
        {devices.length === 0 ? (
          <option>No devices found</option>
        ) : (
          devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} ${d.deviceId.slice(0, 8)}`}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

export default DeviceSettingsModal;