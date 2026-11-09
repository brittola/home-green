interface Props {
  dirty: boolean;
  saving: boolean;
  message: string | null;
  messageTone: 'success' | 'error' | null;
  onConfirm: () => void;
  onReset: () => void;
}

export function ConfirmBar({ dirty, saving, message, messageTone, onConfirm, onReset }: Props) {
  return (
    <div className="confirm-bar">
      <span className={`confirm-message${messageTone ? ` tone-${messageTone}` : ''}`} role="status">
        {message ?? (dirty ? 'Você tem alterações não salvas.' : '')}
      </span>
      <div className="confirm-actions">
        {dirty ? (
          <button type="button" className="button button-ghost" onClick={onReset} disabled={saving}>
            Desfazer
          </button>
        ) : null}
        <button type="button" className="button button-primary" onClick={onConfirm} disabled={!dirty || saving}>
          {saving ? 'Salvando…' : 'Confirmar meus dias'}
        </button>
      </div>
    </div>
  );
}
