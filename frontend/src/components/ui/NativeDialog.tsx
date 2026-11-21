import React, { useEffect, useRef } from 'react';

export interface NativeDialogProps {
  open: boolean;
  onClose: () => void;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  className?: string;
  children: React.ReactNode;
}

export function NativeDialog({
  open,
  onClose,
  ariaLabelledBy,
  ariaLabel,
  className = '',
  children,
}: NativeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingFromPropRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      closingFromPropRef.current = false;
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      closingFromPropRef.current = true;
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      if (closingFromPropRef.current) {
        closingFromPropRef.current = false;
        return;
      }
      onCloseRef.current();
    };

    dialog.addEventListener('close', handleClose);

    // Fallback light-dismiss for browsers without native <dialog closedby="any">
    let cleanupFallback: (() => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e) && dialog.open) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      cleanupFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupFallback?.();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      className={`m-auto p-0 bg-transparent border-0 max-w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-visible open:flex open:flex-col ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}
