import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export default function BackgroundStars({ className }: { className?: string }) {
    const { theme } = useTheme();
    return (
        <div className={cn("absolute inset-0 z-[-1] pointer-events-none left-0 top-0 w-full h-full", className)} style={{
            backgroundImage: "url(/stars.gif)",
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            filter: theme === "dark" ? "invert(0)" : "invert(1)",
        }}>
        </div>
    )
}