import { useState } from "react";
import { login } from "./api";

export default function Login({ onLoginSuccess }) {
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const dniNormalizado = dni.replace(/\D/g, "");
    if (!dniNormalizado || !password) {
      setError("Completa todos los campos");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(dniNormalizado, password);
    setLoading(false);
    if (result.success) {
      onLoginSuccess(result.user);
    } else {
      setError(result.error);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "var(--white)",
          borderRadius: "16px",
          padding: "40px 32px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          border: "1px solid var(--gray-200)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: 68,
              height: 68,
              background: "var(--primary)",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 4px 14px rgba(30,58,138,0.25)",
            }}
          >
            <i
              className="fa-solid fa-truck-fast"
              style={{ fontSize: 28, color: "white" }}
            />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--gray-800)",
              marginBottom: 4,
            }}
          >
            Marcaje Deliveries
          </h1>
          <p
            style={{ color: "var(--gray-500)", fontSize: 14, fontWeight: 500 }}
          >
            Laboratorio Analiza
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* DNI */}
          <div className="input-group">
            <label className="input-label">Número de Identidad</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <i className="fa-regular fa-id-card" />
              </span>
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                placeholder="ID del empleado"
                autoComplete="off"
                inputMode="numeric"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-group">
            <label className="input-label">Contraseña</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <i className="fa-solid fa-lock" />
              </span>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                style={{ fontSize: 16, paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--gray-400)",
                  padding: 8,
                  display: "flex",
                }}
              >
                <i
                  className={`fa-regular ${showPass ? "fa-eye-slash" : "fa-eye"}`}
                  style={{ fontSize: 18 }}
                />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 8, marginBottom: 0 }}
          >
            {loading ? (
              <span className="spinner-inline" />
            ) : (
              <i className="fa-solid fa-right-to-bracket" />
            )}
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
