'use client';

import { useState } from 'react';
import { Crown, UserMinus, UserPlus, LogOut, Pencil, Check, X, Image as ImageIcon } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';

export default function GroupInfoModal({
  open, onClose, conversation, currentUser, permissions,
  onUpdateGroup, onRemoveMember, onToggleAdmin, onLeaveGroup, onOpenAddMembers, onOpenMedia,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(conversation?.name || '');
  const [description, setDescription] = useState(conversation?.description || '');

  if (!conversation) return null;
  const members = conversation.participants?.filter((p) => !p.isDeleted) || [];

  const saveInfo = async () => {
    await onUpdateGroup({ name: name.trim(), description: description.trim() });
    setEditing(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Group info" maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center mb-5">
        <Avatar src={conversation.avatar} name={conversation.name} size="xl" />
        {editing ? (
          <div className="w-full mt-3 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field text-center font-bold" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Group description"
              className="input-field resize-none text-sm"
              rows={2}
            />
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={saveInfo} className="btn btn-primary btn-sm">
                <Check className="w-4 h-4" /> Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h4 className="text-lg font-bold mt-3 flex items-center gap-2">
              {conversation.name}
              {permissions.canEditGroupInfo && (
                <button type="button" onClick={() => setEditing(true)} aria-label="Edit group">
                  <Pencil className="w-3.5 h-3.5 text-base-content/40" />
                </button>
              )}
            </h4>
            {conversation.description && <p className="text-sm text-base-content/55 mt-1 max-w-xs">{conversation.description}</p>}
          </>
        )}
      </div>

      <button type="button" onClick={onOpenMedia} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-field hover:bg-base-200 mb-3">
        <ImageIcon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Shared media</span>
      </button>

      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-bold uppercase tracking-wide text-base-content/50">{members.length} members</h5>
        {permissions.canAddMembers && (
          <button type="button" onClick={onOpenAddMembers} className="text-xs font-semibold text-primary flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      <div className="space-y-1">
        {members.map((p) => {
          const memberId = p.user?._id || p.user;
          const isSelf = memberId?.toString() === currentUser?._id?.toString();
          const isCreator = memberId?.toString() === conversation.createdBy?.toString();

          return (
            <div key={memberId} className="flex items-center gap-3 px-2 py-2 rounded-field hover:bg-base-200">
              <Avatar src={p.user?.avatar} name={p.user?.name} size="sm" online={p.user?.isOnline} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {p.user?.name} {isSelf && <span className="text-base-content/40">(you)</span>}
                  {(p.isAdmin || isCreator) && <Crown className="w-3.5 h-3.5 text-warning" />}
                </p>
                <p className="text-xs text-base-content/45 capitalize">{p.user?.role}</p>
              </div>

              {!isSelf && permissions.canToggleAdmin?.(memberId) && (
                <button type="button" onClick={() => onToggleAdmin(memberId, !p.isAdmin)} className="text-[11px] font-semibold text-base-content/55 hover:text-primary">
                  {p.isAdmin ? 'Remove admin' : 'Make admin'}
                </button>
              )}
              {!isSelf && permissions.canRemoveMember?.(memberId) && (
                <button type="button" onClick={() => onRemoveMember(memberId)} aria-label="Remove member">
                  <UserMinus className="w-4 h-4 text-error" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {permissions.canLeaveGroup && (
        <button
          type="button"
          onClick={onLeaveGroup}
          className="w-full flex items-center justify-center gap-2 mt-5 py-2.5 rounded-field text-error font-semibold text-sm hover:bg-error/10"
        >
          <LogOut className="w-4 h-4" /> Leave group
        </button>
      )}
    </Modal>
  );
}
