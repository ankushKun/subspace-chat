import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";
import { FaApple, FaDiscord, FaGoogle, FaXTwitter } from "react-icons/fa6"
import { BiWallet } from "react-icons/bi";
import TextWLine from "@/components/text-w-line";
import { useActiveAddress, useConnection, useProfileModal } from "@arweave-wallet-kit/react"
import { useNavigate } from "react-router-dom"
import BackgroundStars from "@/components/background-stars";


enum LoginStep {
  Landing = "landing",
  Login = "login",
  Register = "register",
}

export default function Landing() {
  const [loginStep, setLoginStep] = useState<LoginStep>(LoginStep.Landing);
  const { connect, connected, disconnect } = useConnection();
  const { setOpen } = useProfileModal();
  const address = useActiveAddress();
  const navigate = useNavigate();

  useEffect(() => {
    if (connected) {
      console.log("connected", address);
      navigate("/app");
    }
  }, [connected, address]);

  async function start() {
    if (connected) {
      console.log("connected", address);
      navigate("/app");
    }
    else
      setLoginStep(LoginStep.Login);
  }

  async function loginWithArweave() {
    if (connected)
      setOpen(true);
    else
      connect().then(() => navigate("/app"));
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
            onClick={start}>
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
                <Button variant="outline" size="icon" disabled>
                  <FaDiscord />
                </Button>
                <Button variant="outline" size="icon" disabled>
                  <FaApple />
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
        <div className="text-xs text-muted-foreground/60 p-0 mt-2">
          {/* @ts-ignore */}
          v{__APP_VERSION__}
        </div>
      </div>
    </div>
  );
}