import { cn } from "@/lib/utils";

export default function TextWLine({ children, className }: { children?: React.ReactNode, className?: string }) {
    return (<div className={cn("w-24 text-muted-foreground/80 text-sm flex items-center gap-2", className)}>
        {children ? (
            <>
                <div className="w-full h-[1px] bg-muted-foreground/80" />
                {children}
                <div className="w-full h-[1px] bg-muted-foreground/80" />
            </>
        ) : (
            <div className="w-full h-[1px] bg-muted-foreground/80" />
        )}
    </div>)
}