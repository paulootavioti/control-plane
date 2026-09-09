import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "icon" }) {
  return <button className={`button button-${variant} ${className}`.trim()} {...props} />;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className={`input ${props.className ?? ""}`.trim()} {...props} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={`input select ${props.className ?? ""}`.trim()} {...props} />; }
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`cartao ${className}`.trim()}>{children}</section>; }
export function Field({ id, label, help, error, children, wide = false }: { id: string; label: string; help?: string; error?: string; children: ReactNode; wide?: boolean }) {
  return <div className={`field${wide ? " field-wide" : ""}`}><label htmlFor={id}>{label}</label>{children}{help && <small id={`${id}-help`} className="field-help">{help}</small>}{error && <small id={`${id}-error`} className="field-error">{error}</small>}</div>;
}
export function StatusBadge({ status, children }: { status: string; children: ReactNode }) { return <span className={`status-badge status-${status.toLowerCase().replace(/_/g, "-")}`}>{children}</span>; }
export function Table({ children, label }: { children: ReactNode; label: string }) { return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table>{children}</table></div>; }
export function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  return <div className="pagination"><span className="result-count">{total} {total === 1 ? "resultado" : "resultados"}</span>{totalPages > 1 && <div><Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button><span aria-live="polite">Página {page} de {totalPages}</span><Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Próxima</Button></div>}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <section className="empty-state"><h2>{title}</h2><p>{description}</p>{action}</section>; }
export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) { if (!message) return null; return <div className="error-message" role="alert"><strong>Não foi possível concluir.</strong><p>{message}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>}</div>; }
export function Skeleton({ rows = 4 }: { rows?: number }) { return <div className="skeleton" aria-label="Carregando conteúdo" aria-busy="true">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>; }
export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "danger" }) { if (!message) return null; return <div className={`toast toast-${tone}`} role="status" aria-live="polite">{message}</div>; }
export function ConfirmDialog({ open, title, description, confirmation, busy, onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmation: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState(""); if (!open) return null;
  return <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><h2 id="dialog-title">{title}</h2></header><div className="dialog-body"><p>{description}</p><Field id="confirmacao" label={`Digite ${confirmation} para confirmar`}><Input id="confirmacao" value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus /></Field></div><footer><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button className="button-danger" disabled={busy || typed !== confirmation} onClick={onConfirm}>{busy ? "Processando…" : "Confirmar"}</Button></footer></section></div>;
}
export function PageHeader({ kicker, title, actions, badge }: { kicker: string; title: string; actions?: ReactNode; badge?: ReactNode }) { return <header className="page-header"><p className="kicker">{kicker}</p><div><h1>{title}</h1>{badge}{actions && <aside>{actions}</aside>}</div></header>; }
export interface Stat { label: string; value: ReactNode; context?: string; critical?: boolean }
export function StatBand({ stats, secondary = false }: { stats: Stat[]; secondary?: boolean }) { return <div className={`stat-band${secondary ? " stat-band-secondary" : ""}`}>{stats.map((stat) => <section key={stat.label} className={stat.critical ? "stat-critical" : ""}><p>{stat.label}</p><strong>{stat.value}</strong>{stat.context && <small>{stat.context}</small>}</section>)}</div>; }
