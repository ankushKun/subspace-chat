import type { Components } from "react-markdown";
import { cn } from "./utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export const mdComponents: Components = {
    a: ({ node, ...props }) => {
        // return <a {...props} className={cn(props.className, "text-blue-500 hover:underline")} target="_blank" rel="noopener noreferrer" />
        return <Dialog>
            <DialogTrigger asChild>
                <a
                    {...props}
                    href={undefined}
                    className={cn(props.className, "text-blue-500 hover:underline cursor-pointer")}
                />
            </DialogTrigger>
            <DialogContent className="">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold break-words">Hol' Up!</h3>
                    <p>You are about to open a link sent by someone on Subspace. It may be malicious or contain malware. Check all links before opening it.</p>
                    <div className="space-y-2">
                        <p><strong>Text:</strong> <span className="font-mono break-all">{props.children}</span></p>
                        <p><strong>URL:</strong> <span className="font-mono break-all text-sm text-blue-500">{props.href}</span></p>
                    </div>
                    <div className="flex gap-2">
                        <a
                            href={props.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                        >
                            Open Link
                        </a>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    }
}