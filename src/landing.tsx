import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { FaApple, FaDiscord, FaGoogle, FaPuzzlePiece, FaXTwitter } from "react-icons/fa6"
import { BiWallet } from "react-icons/bi";
import TextWLine from "@/components/text-w-line";
import { useWallet, ConnectionStrategies } from '@/hooks/use-wallet';
import { useNavigate } from "react-router-dom"
import BackgroundStars from "@/components/background-stars";
import { CornerDownLeftIcon, WalletCards, WalletCardsIcon } from "lucide-react";
import { useGlobalState } from "@/hooks";
import { Switch } from "@/components/ui/switch"
import s from "@/assets/s.png"


enum LoginStep {
  Landing = "landing",
  Login = "login"
}

export default function Landing() {
  const [loginStep, setLoginStep] = useState<LoginStep>(LoginStep.Landing);
  const { connect, connected, address, disconnect, wanderInstance } = useWallet();
  const navigate = useNavigate();
  const [sClickCount, setSClickCount] = useState(0);
  const [showClickCount, setShowClickCount] = useState(false);

  useEffect(() => {
    if (connected && address) {
      // Check for a stored route from a previous session
      const lastRoute = sessionStorage.getItem('last_app_route');
      if (lastRoute) {
        // Clear the stored route
        sessionStorage.removeItem('last_app_route');
        // Navigate to the stored route directly
        window.location.hash = lastRoute;
      } else {
        // Otherwise, navigate to the default app route
        navigate("/app");
      }
    }
  }, [connected, address, navigate]);

  async function start() {
    if (connected && address) {
      // Check for a stored route from a previous session
      const lastRoute = sessionStorage.getItem('last_app_route');
      if (lastRoute) {
        // Clear the stored route
        sessionStorage.removeItem('last_app_route');
        // Navigate to the stored route directly
        window.location.hash = lastRoute;
      } else {
        // Otherwise, navigate to the default app route
        navigate("/app");
      }
    }
    else
      setLoginStep(LoginStep.Login);
  }

  useEffect(() => {
    // reset click count if not clicked for 3 seconds
    const interval = setInterval(() => {
      setShowClickCount(false);
      setSClickCount(0);
    }, 3000);
    return () => clearInterval(interval);
  }, [sClickCount]);

  function updateColor() {
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    document.getElementById("random-color")?.setAttribute("style", `color: #${randomColor}`);
  }

  async function sClicked() {
    setSClickCount(prev => prev + 1);
    if (sClickCount == 4) {
      setShowClickCount(true);
    }
    if (sClickCount >= 4) {
      const audio = new Audio("/audio/dum.wav");
      audio.play();
    }
    if (sClickCount == 68) {
      const audio = new Audio("/audio/laugh.wav");
      audio.volume = 1;
      audio.play();
    }
    if (sClickCount == 69) {
      setSClickCount(0);
    }

    updateColor();
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-mono relative" >
      <BackgroundStars />
      <div className="absolute top-4 right-4 flex flex-col gap-2 justify-center items-end">
        <div className="relative flex items-center justify-end gap-2">
          {showClickCount && <div className="text-muted-foreground/60 p-0 text-xl shadow-lg backdrop-blur-sm rounded mb-1.5" id="random-color">
            {sClickCount}
          </div>}
          <img src={s} className="w-8 h-8 mb-2.5 mr-1 cursor-pointer" onClick={sClicked} draggable={false} />
        </div>
        <ModeToggle />
      </div>

      <div className="rounded-lg w-full max-w-5xl mx-4 p-12 flex flex-col items-center justify-center" style={{ minHeight: '70vh' }}>
        <h1 className="text-6xl md:text-8xl font-bold mb-6 flex items-center space-x-2 select-none">
          <span className="font-normal text-outline">SUB</span>
          <span className="font-bold text-foreground">SPACE</span>
        </h1>
        <p className="text-foreground/70 text-lg mb-12 tracking-wide text-center">Your intergalactic communications system</p>
        {loginStep === LoginStep.Landing && (
          <Button variant="outline" className="text-lg p-6 animate-bounce"
            onClick={start}>
            PRESS START ⓐ
          </Button>
        )}
        {loginStep === LoginStep.Login && (
          <div className="flex flex-col items-center justify-center gap-5">
            <div className="flex flex-col gap-4">
              {window.arweaveWallet && <Button variant="outline" onClick={() => connect(ConnectionStrategies.ArWallet)}
                className="items-center justify-center gap-2 text-lg p-6 !px-8">
                <div>WEB WALLET</div> <CornerDownLeftIcon />
              </Button>}
              <Button variant="outline" onClick={() => connect(ConnectionStrategies.WanderConnect)}
                className="items-center justify-center gap-2 text-lg p-6 !px-8">
                <div>WANDER CONNECT</div> <CornerDownLeftIcon />
              </Button>
              <Button variant="outline" onClick={() => connect(ConnectionStrategies.JWK)}
                className="items-center justify-center gap-2 text-lg p-6 !px-8" >
                <div>SCAN QR</div> <CornerDownLeftIcon />
              </Button>
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
        <div className="text-xs text-muted-foreground/60 p-0 mt-4">
          {/* @ts-ignore */}
          v{__APP_VERSION__}
        </div>
      </div>
    </div>
  );
}