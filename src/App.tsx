import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { useTheme } from "@/components/theme-provider";
import { cn } from "./lib/utils";
import { Input } from "@/components/ui/input";
import { FaGoogle, FaXTwitter } from "react-icons/fa6"
import { BiWallet } from "react-icons/bi";
import TextWLine from "@/components/text-w-line";
import { toast } from "sonner";

enum LoginStep {
  Landing = "landing",
  Login = "login",
  Register = "register",
}

function BackgroundStars({ className }: { className?: string }) {
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

function App() {
  const [loginStep, setLoginStep] = useState<LoginStep>(LoginStep.Landing);

  function loginWithArweave() {

  }

  return (
    <div className="min-h-screen flex items-center justify-center font-mono relative" >
      <BackgroundStars />
      <ModeToggle className="absolute top-4 right-4" />
      <div className="rounded-lg w-full max-w-5xl mx-4 p-12 flex flex-col items-center justify-center" style={{ minHeight: '70vh' }}>
        <h1 className="text-6xl md:text-8xl font-bold mb-6 flex items-center space-x-2 select-none">
          <span className="font-normal text-outline">SUB</span>
          <span className="font-bold text-foreground">SPACE</span>
        </h1>
        <p className="text-foreground/70 text-lg mb-12 tracking-wide text-center">Your intergalactic communications system</p>
        {loginStep === LoginStep.Landing && (
          <Button variant="outline" className="text-lg p-6"
            onClick={() => setLoginStep(LoginStep.Login)}>
            PRESS START
          </Button>
        )}
        {loginStep === LoginStep.Login && (
          <div className="flex flex-col items-center justify-center gap-5">
            {/* <div className="flex flex-col gap-4 w-full">
              <Input
                type="email"
                placeholder="email"
                id="email"
                disabled
              />
              <Input
                type="password"
                placeholder="password"
                id="password"
                disabled
              />
            </div>
            <TextWLine className="w-[269px] opacity-70" /> */}
            <div className="flex flex-col gap-4">
              <Button variant="outline" className="items-center justify-center gap-2" onClick={loginWithArweave}>
                <div>Arweave</div> <BiWallet />
              </Button>
              <TextWLine className="w-[269px] opacity-70" />
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="icon" disabled>
                  <FaGoogle />
                </Button>
                <Button variant="outline" size="icon" disabled>
                  <FaXTwitter />
                </Button>
              </div>
            </div>
            {/* <div className="flex items-center justify-center gap-2 text-muted-foreground">
              Dont have an account?
              <Button variant="link" className="p-0"
                onClick={() => setLoginStep(LoginStep.Register)}>
                Register
              </Button>
            </div> */}
          </div>
        )}
        {loginStep === LoginStep.Register && (
          <div>
            {/* Registration form will go here */}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
