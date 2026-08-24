import { useState, useRef, useEffect } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { Building2, ChevronDown, Loader2 } from 'lucide-react';
import type { Facility } from '@debtflow/shared';

interface UnifiedFacilitySelectProps {
  facilities: Facility[];
  selectedIds: string[]; // List of selected facility IDs
  onChange: (ids: string[]) => void;
  allowAll?: boolean;
}

export default function UnifiedFacilitySelect({
  facilities,
  selectedIds,
  onChange,
  allowAll = true,
}: UnifiedFacilitySelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeFacilities = facilities.filter((f) => f.status === 'ACTIVE');
  const total = activeFacilities.length;

  // Effective selected array (if empty, treat as all selected)
  const currentSelectedIds =
    selectedIds.length === 0 ? activeFacilities.map((f) => f.id) : selectedIds;

  const isAllSelected =
    total > 0 && currentSelectedIds.length === total;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleAll = () => {
    if (isAllSelected) {
      // Keep only 1st facility
      onChange(activeFacilities[0] ? [activeFacilities[0].id] : []);
    } else {
      // Select all
      onChange(activeFacilities.map((f) => f.id));
    }
  };

  const handleToggleOne = (id: string) => {
    if (currentSelectedIds.includes(id)) {
      const next = currentSelectedIds.filter((item) => item !== id);
      if (next.length === 0) return;
      onChange(next);
    } else {
      const next = [...currentSelectedIds, id];
      onChange(next);
    }
  };

  // Label text
  const labelText = (() => {
    if (total === 0) return 'Cơ sở';
    if (isAllSelected) {
      return `Cơ sở: Tất cả (${total}/${total})`;
    }
    if (currentSelectedIds.length === 1) {
      const found = activeFacilities.find((f) => f.id === currentSelectedIds[0]);
      return `Cơ sở: 1/${total} (${found?.name || '1 cơ sở'})`;
    }
    const names = currentSelectedIds
      .map((id) => activeFacilities.find((f) => f.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', ');
    const more = currentSelectedIds.length > 2 ? `, +${currentSelectedIds.length - 2}` : '';
    return `Cơ sở: ${currentSelectedIds.length}/${total} (${names}${more})`;
  })();

  const isFetching = useIsFetching();

  return (
    <div ref={containerRef} className="unified-facility-select" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="unified-facility-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.45rem',
          padding: '0.45rem 0.85rem',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          fontSize: '0.88rem',
          fontWeight: 600,
          color: '#1e293b',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {isFetching > 0 ? (
            <Loader2 size={15} className="animate-spin" style={{ color: 'var(--df-primary)' }} />
          ) : (
            <Building2 size={15} style={{ color: 'var(--df-primary)' }} />
          )}
          <span>{labelText}</span>
        </div>
        <ChevronDown size={14} style={{ color: '#64748b', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          className="unified-facility-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 99999,
            minWidth: '240px',
            maxWidth: 'calc(100vw - 32px)',
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
            padding: '0.4rem 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {allowAll && (
            <>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  cursor: 'pointer',
                  background: isAllSelected ? '#eff6ff' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleAll}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--df-primary)', cursor: 'pointer' }}
                />
                <span>Tất cả cơ sở ({total})</span>
              </label>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '0.2rem 0' }} />
            </>
          )}

          {activeFacilities.map((f) => {
            const checked = currentSelectedIds.includes(f.id);
            return (
              <label
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.88rem',
                  color: '#334155',
                  cursor: 'pointer',
                  background: checked && currentSelectedIds.length === 1 ? '#f0fdf4' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!checked || currentSelectedIds.length > 1) e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  if (!checked || currentSelectedIds.length > 1) e.currentTarget.style.background = 'transparent';
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleOne(f.id)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--df-primary)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: checked ? 600 : 400, color: checked ? '#0f172a' : '#475569' }}>
                  {f.name}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
