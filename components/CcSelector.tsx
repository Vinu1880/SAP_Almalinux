'use client';

import { useState } from 'react';
import { X, UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface CcCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  workPercent?: number | null;
}

interface CcSelectorProps {
  candidates: CcCandidate[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
  addLabel: string;
  emptyLabel: string;
  jokerLabel: string;
  disabled?: boolean;
}

/**
 * Pick people to copy on an invitation.
 *
 * Availability is deliberately not checked: a copied person only watches the
 * slot, so being on holiday or already booked does not disqualify them. Jokers
 * (workPercent 0) are offered like anyone else, and flagged so the planner
 * knows what they are picking.
 */
export function CcSelector({
  candidates,
  selectedIds,
  onChange,
  label,
  addLabel,
  emptyLabel,
  jokerLabel,
  disabled = false,
}: CcSelectorProps) {
  const [open, setOpen] = useState(false);

  const selected = candidates.filter(c => selectedIds.includes(c.id));

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className="h-7 text-xs hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition-colors"
        >
          <UserPlus className="w-3 h-3 mr-1" />
          {addLabel}
        </Button>
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(u => (
            <Badge
              key={u.id}
              variant="outline"
              className="bg-sky-50 border-sky-200 text-sky-700 pl-2 pr-1 py-0.5 gap-1 font-normal"
            >
              {u.firstName} {u.lastName}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  className="rounded-full p-0.5 hover:bg-sky-200/70 transition-colors"
                  aria-label={`${u.firstName} ${u.lastName}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      )}

      {open && !disabled && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <ScrollArea className="max-h-48">
            <div className="p-1">
              {candidates.map(u => {
                const isSelected = selectedIds.includes(u.id);
                const isJoker = (u.workPercent ?? 100) === 0;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                      isSelected ? 'bg-sky-50 text-sky-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-sky-600 border-sky-600' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate flex-1">
                      {u.firstName} {u.lastName}
                    </span>
                    {isJoker && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-purple-50 border-purple-200 text-purple-700 px-1 py-0 flex-shrink-0"
                      >
                        {jokerLabel}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
