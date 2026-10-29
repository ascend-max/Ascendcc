import React from 'react';
import { useStore } from '../state/store';
import { Icon } from './Icon';

export function ToastStack(): React.ReactElement {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span>{toast.message}</span>
          <button className="icon-button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
