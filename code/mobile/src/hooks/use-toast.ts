import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  action?: React.ReactNode;
}

interface ToastState {
  toasts: Toast[];
}

let toastCount = 0;

function genId() {
  toastCount = (toastCount + 1) % Number.MAX_VALUE;
  return toastCount.toString();
}

const listeners: Array<(state: ToastState) => void> = [];
let memoryState: ToastState = { toasts: [] };

function dispatch(action: { type: 'ADD_TOAST'; toast: Toast } | { type: 'DISMISS_TOAST'; toastId: string } | { type: 'REMOVE_TOAST'; toastId: string }) {
  memoryState = reducer(memoryState, action);
  listeners.forEach(listener => listener(memoryState));
}

function reducer(state: ToastState, action: { type: string; toast?: Toast; toastId?: string }): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast!] };
    case 'DISMISS_TOAST':
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.toastId) };
    default:
      return state;
  }
}

export function toast({ ...props }: Omit<Toast, 'id'>) {
  const id = genId();

  const update = (toast: Toast) => dispatch({ type: 'ADD_TOAST', toast: { ...toast, id } });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: { ...props, id },
  });

  setTimeout(dismiss, 5000);

  return { id, dismiss, update };
}

export function useToast() {
  const [state, setState] = useState<ToastState>(memoryState);

  const listen = useCallback((newState: ToastState) => {
    setState(newState);
  }, []);

  useState(() => {
    listeners.push(listen);
    return () => {
      const index = listeners.indexOf(listen);
      if (index > -1) listeners.splice(index, 1);
    };
  });

  return { ...state, toast };
}