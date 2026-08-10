
"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

const DialogContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
} | null>(null);

export function Dialog({
    children,
    open: controlledOpen,
    onOpenChange,
}: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;
    const setOpen = React.useCallback(
        (v: boolean) => {
            if (onOpenChange) onOpenChange(v);
            if (!isControlled) setUncontrolledOpen(v);
        },
        [isControlled, onOpenChange]
    );

    return (
        <DialogContext.Provider value={{ open, setOpen }}>
            {children}
        </DialogContext.Provider>
    );
}

export function DialogTrigger({
    asChild,
    children,
    ...props
}: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
    const ctx = React.useContext(DialogContext);
    if (!ctx) throw new Error("DialogTrigger must be used within Dialog");

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: (e: React.MouseEvent) => {
                (children as any).props.onClick?.(e);
                ctx.setOpen(true);
            },
            ...props
        });
    }

    return (
        <button type="button" onClick={() => ctx.setOpen(true)} {...props}>
            {children}
        </button>
    );
}

export function DialogContent({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const ctx = React.useContext(DialogContext);
    if (!ctx) throw new Error("DialogContent must be used within Dialog");

    const { open, setOpen } = ctx;

    // Escape to close and a locked background scroll are what users expect from
    // a modal; neither was wired up.
    React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, setOpen]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                className={cn(
                    "relative max-h-[90dvh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl",
                    "animate-in zoom-in-95 duration-200",
                    className
                )}
            >
                <button
                    type="button"
                    aria-label="Close"
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                    onClick={() => setOpen(false)}
                >
                    <span className="sr-only">Close</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
                </button>
                {children}
            </div>
        </div>
    );
}

export function DialogHeader({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
            {...props}
        />
    );
}

export function DialogTitle({
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h2
            className={cn("text-lg font-semibold leading-none tracking-tight", className)}
            {...props}
        />
    );
}

export function DialogDescription({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={cn("text-sm text-foreground/70", className)}
            {...props}
        />
    );
}

DialogDescription.displayName = "DialogDescription";

export function DialogFooter({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
            {...props}
        />
    );
}

DialogFooter.displayName = "DialogFooter";
