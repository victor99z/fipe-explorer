import React, { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck, X } from 'lucide-react';
import { ClientResponseError } from 'pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { NativeDialog } from '../ui/NativeDialog';

export interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  contextMessage?: string;
}

function parsePocketBaseAuthError(err: unknown): string {
  if (err instanceof ClientResponseError) {
    const data = err.response?.data as Record<string, { message?: string }> | undefined;
    if (data?.email?.message) {
      return `E-mail: ${data.email.message}`;
    }
    if (data?.password?.message) {
      return `Senha: ${data.password.message}`;
    }
    if (err.status === 400) {
      return 'E-mail ou senha incorretos.';
    }
    if (err.status === 0) {
      return 'Não foi possível conectar ao servidor PocketBase. Verifique se ele está online.';
    }
  }
  return err instanceof Error ? err.message : 'Erro ao autenticar.';
}

export function AuthModal({
  open,
  onClose,
  contextMessage,
}: AuthModalProps) {
  const { login } = useAuth();
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setShowPassword(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      setPassword('');
      onClose();
    } catch (err) {
      setError(parsePocketBaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <NativeDialog open={open} onClose={onClose} ariaLabelledBy={titleId}>
      <div className="w-full sm:w-[420px] rounded-xl border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#15803d] dark:text-[#3ecf8e]">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>PocketBase Auth</span>
            </div>
            <h2 id={titleId} className="text-base font-semibold text-[#171717] dark:text-[#ededed]">
              Entrar no fipex
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de autenticação"
            className="h-8 w-8 inline-flex items-center justify-center rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {contextMessage && (
            <div className="rounded-lg border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 px-3.5 py-2.5 text-xs text-[#15803d] dark:text-[#3ecf8e]">
              {contextMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label
                htmlFor={emailId}
                className="block text-xs font-medium text-[#171717] dark:text-[#ededed]"
              >
                E-mail
              </label>
              <input
                id={emailId}
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                required
                autoFocus
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="field-input w-full h-9 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-sm text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
              />
              <span className="field-error text-[11px] text-rose-600 dark:text-rose-400">
                Informe um endereço de e-mail válido.
              </span>
            </div>

            <div className="space-y-1">
              <label
                htmlFor={passwordId}
                className="block text-xs font-medium text-[#171717] dark:text-[#ededed]"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id={passwordId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  enterKeyHint="done"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field-input w-full h-9 pl-3 pr-10 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-sm text-[#171717] dark:text-[#ededed] focus:outline-none focus:border-[#3ecf8e]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-[4px] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Entrar na conta</span>
            </button>
          </form>

          <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] text-center">
            Novos usuários são cadastrados manualmente pelo administrador no PocketBase.
          </p>
        </div>
      </div>
    </NativeDialog>
  );
}
