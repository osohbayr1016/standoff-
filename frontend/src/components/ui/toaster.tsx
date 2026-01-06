import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-zinc-900 group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg",
                    description: "group-[.toast]:text-zinc-400",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                    cancelButton:
                        "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300",
                    success: "group-[.toast]:border-green-500/20 group-[.toast]:bg-green-950/20",
                    error: "group-[.toast]:border-red-500/20 group-[.toast]:bg-red-950/20",
                    warning: "group-[.toast]:border-yellow-500/20 group-[.toast]:bg-yellow-950/20",
                    info: "group-[.toast]:border-blue-500/20 group-[.toast]:bg-blue-950/20",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
