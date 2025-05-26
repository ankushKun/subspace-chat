import { cn } from "@/lib/utils";

export default function ArioBadge(props: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("aspect-square rounded-full overflow-hidden inline-flex items-center justify-center", props.className)} {...props}>
        <img src="https://arweave.net/Sie_26dvgyok0PZD_-iQAFOhOd5YxDTkczOLoqTTL_A" alt="ario" className="w-full h-full object-cover aspect-square" />
    </div>
}