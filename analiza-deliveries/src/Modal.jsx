export default function Modal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-icon">
          <i
            className="fa-solid fa-circle-question"
            style={{ color: "var(--primary)", fontSize: 48 }}
          />
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-text">{message}</p>
        <div className="modal-buttons">
          <button onClick={onCancel} className="modal-btn modal-btn-cancel">
            Cancelar
          </button>
          <button onClick={onConfirm} className="modal-btn modal-btn-confirm">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
