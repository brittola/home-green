interface Props {
  dirty: boolean;
  saving: boolean;
  message: string | null;
  onConfirm: () => void;
  onReset: () => void;
}

export function ConfirmBar({ dirty, saving, message, onConfirm, onReset }: Props) {
  return (
    <div className="confirm-bar">
      <span className="confirm-message" role="status">
        {message}
      </span>
      {dirty ? (
        <button type="button" className="button-secondary" onClick={onReset} disabled={saving}>
          Desfazer
        </button>
      ) : null}
      <button type="button" className="button-primary" onClick={onConfirm} disabled={!dirty || saving}>
        {saving ? 'Salvando…' : 'Confirmar meus dias'}
      </button>
    </div>
  );
}
