'use client';

import { useActionState, useEffect, useRef, startTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  id?: string;
  at?: number;
};

type Options = {
  /** Para onde ir após salvar (string ou função do resultado). */
  redirectTo?: string | ((state: FormState) => string | undefined);
  onSuccess?: (state: FormState) => void;
  successToast?: boolean;
};

/**
 * Envia um formulário para uma Server Action sem resetar os campos em caso
 * de erro (o React 19 limpa formulários com action={...} automaticamente).
 */
export function useFormAction(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  options: Options = {},
) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const router = useRouter();
  const last = useRef<number | undefined>(undefined);
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    if (!state.at || state.at === last.current) return;
    last.current = state.at;
    if (state.ok) {
      if (opts.current.successToast !== false && state.message) toast.success(state.message);
      opts.current.onSuccess?.(state);
      const target =
        typeof opts.current.redirectTo === 'function' ? opts.current.redirectTo(state) : opts.current.redirectTo;
      if (target) router.push(target);
      else router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };

  const submitData = (fd: FormData) => startTransition(() => formAction(fd));

  return { state, pending, onSubmit, submitData, errors: state.fieldErrors ?? {} };
}
