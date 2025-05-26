import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { NavLink } from "react-router";

export default function NotFound() {
    return <div className="flex flex-col items-center justify-center h-screen bg-primary text-primary-foreground">
        <h1 className="text-8xl font-bold font-ka tracking-widest max-w-screen overflow-clip">404</h1>
        <p className="text-lg mt-4">Page not found</p>
        <NavLink to="/app">
            <Button variant="secondary" className="mt-4 bg-white text-black">
                Go to App <ArrowRight className="ml-2" />
            </Button>
        </NavLink>
    </div>
}