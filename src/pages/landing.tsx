import { Button } from "@/components/ui/button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import LoginDialog from "../components/login-dialog";
import { useIsMobile } from "../hooks/use-mobile";
import { useWallet } from "@/hooks/use-wallet";
import { useEffect, useRef } from "react";

import s1 from "@/assets/s1.png";
import s2 from "@/assets/s2.png";
import chk from "@/assets/chkthisout.png";
import { ExternalLink } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";

export default function SubspaceLanding() {
  const isMobile = useIsMobile();
  const connected = useWallet((state) => state.connected);
  const navigate = useNavigate();
  const wasConnectedOnMount = useRef(connected);

  // Redirect to /app only when user authenticates on this page (goes from not connected to connected)
  useEffect(() => {
    if (!wasConnectedOnMount.current && connected) {
      navigate("/app");
    }
  }, [connected, navigate]);

  // force this page to always be in light mode
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <title>Subspace</title>
      {connected ? (
        <NavLink to="/app">
          <Button className="absolute top-8 right-6 z-20 font-bold">
            Go Subspace <ExternalLink />
          </Button>
        </NavLink>
      ) : (
        <LoginDialog>
          <Button className="absolute top-6 right-6 z-20 font-bold">
            Login
          </Button>
        </LoginDialog>
      )}

      <ThemeToggleButton className="absolute top-4 left-4 z-20" />

      <div className="h-screen relative flex flex-col items-center justify-center">
        <div className="drop-shadow-2xl drop-shadow-primary/40">
          <svg
            width="1200"
            height="596"
            viewBox="0 0 1639 596"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: "var(--primary)" }}
          >
            <path
              d="M282.511 31.9736H11.3008V103.026H282.511V266.448H0V0H282.511V31.9736ZM0.00195312 206.053H271.212V135H0.00195312V206.053Z"
              fill="currentColor"
            />
            <path
              d="M621.524 266.448H339.014V0H353.139V206.053H607.397V0H621.524V266.448Z"
              fill="currentColor"
            />
            <path
              d="M960.536 266.448H678.025V0H960.536V266.448ZM692.151 135V206.053H946.41V135H692.151ZM692.152 103.026H918.161V31.9736H692.152V103.026Z"
              fill="currentColor"
            />
            <path
              d="M282.511 360.974H11.3008V432.026H282.511V595.448H30.3447L0 567V535H271.211V464H30L0 434V329H282.511V360.974Z"
              fill="currentColor"
            />
            <path
              d="M5.81212 595V581H8.18788V595H5.81212ZM0 589.188V586.812H14V589.188H0Z"
              fill="currentColor"
            />
            <path
              d="M621.526 595H621.525V484.868H353.141V595H339.016V328.552H621.526V595ZM353.139 431.578H607.397V360.525H353.139V431.578Z"
              fill="currentColor"
            />
            <path
              d="M960.538 595H946.408V484.868H692.149V595H678.027V328.552H960.538V595ZM692.149 431.578H946.408V360.525H692.149V431.578Z"
              fill="currentColor"
            />
            <path
              d="M1299.55 360.525H1031.16V534.605H1299.55V595H1017.04V328.552H1299.55V360.525Z"
              fill="currentColor"
            />
            <path
              d="M1638.56 360.525H1370.18V431.578H1638.56V463.552H1370.18V534.604H1638.56V595H1356.05V328.552H1638.56V360.525Z"
              fill="currentColor"
            />
            <rect x="1017" width="622" height="266" fill="currentColor" />
            <path
              d="M1327.85 51.8701C1392.5 52.0366 1456.65 74.7222 1456.65 120.354C1456.65 176.775 1350.23 234.319 1326.33 234.319C1302.43 234.319 1196 176.775 1196 120.354C1196 74.7223 1260.15 52.0367 1324.8 51.8701H1327.85ZM1309.85 215.969H1315.48V217.442H1309.85V218.696H1315.71V215.306H1310.09V213.832H1315.71V213.169H1309.85V215.969ZM1317 218.696H1322.86V218.694H1317.29V216.41H1322.86V213.169H1317V218.696ZM1324.15 218.696H1330.01V213.169H1324.15V218.696ZM1331.29 218.696H1337.15V217.443H1331.58V213.832H1337.15V213.169H1331.29V218.696ZM1338.43 218.696H1344.29V217.442H1338.73V215.969H1344.29V215.306H1338.73V213.832H1344.29V213.169H1338.43V218.696ZM1329.72 218.694H1324.44V216.41H1329.72V218.694ZM1322.57 215.306H1317.29V213.832H1322.57V215.306ZM1329.72 215.306H1324.44V213.832H1329.72V215.306ZM1322.12 198.113H1324.7V198.789H1322.12V199.359H1324.8V197.806H1322.23V197.13H1324.8V196.824H1322.12V198.113ZM1325.35 199.359H1328.04V196.824H1327.91V198.784H1325.49V196.824H1325.35V199.359ZM1328.57 199.359H1331.26V196.824H1328.57V199.359ZM1331.12 198.789H1328.71V198.113H1331.12V198.789ZM1330.86 197.806H1328.71V197.13H1330.86V197.806ZM1275.62 120.965C1264.07 106.556 1244.5 93.6781 1225.84 101.977L1224.67 102.614C1223.84 103.02 1223.02 103.429 1222.19 103.84L1221.57 104.248C1215.28 108.076 1213.06 113.704 1212.07 119.115C1204.26 171.25 1277.7 181.995 1314.37 174.092C1308 168.008 1302.46 162.316 1297.35 155.699C1296.73 154.89 1296.11 154.084 1295.46 153.284C1291.6 148.54 1288.84 143.629 1286.16 138.552C1283.01 132.586 1280.04 126.585 1275.62 120.965ZM1426.82 101.977C1408.16 93.6781 1388.58 106.556 1377.04 120.965C1372.61 126.585 1369.64 132.586 1366.49 138.552C1363.81 143.629 1361.05 148.54 1357.19 153.284C1356.54 154.084 1355.92 154.89 1355.31 155.699C1350.2 162.316 1344.66 168.008 1338.28 174.092C1374.96 181.995 1448.39 171.25 1440.58 119.115C1439.59 113.704 1437.37 108.076 1431.09 104.248L1430.46 103.84C1429.64 103.429 1428.81 103.02 1427.98 102.614L1426.82 101.977Z"
              fill="#131313"
            />
            <path
              d="M1459.12 72V38H1464.88V72H1459.12ZM1445 57.8848V52.1152H1479V57.8848H1445Z"
              fill="#131313"
            />
          </svg>
        </div>
        <div className="font-vipnagorgialla tracking-wider text-xs sm:text-sm md:text-xl scale-y-130 mt-2.5 drop-shadow-xl">
          Group chat with your friends!
        </div>
      </div>
      <div className="flex -mt-22 flex-col h- mx-auto overflow-x-clip max-w-screen min-w-screen z-20 items-center justify-start gap-2">
        <img
          draggable={false}
          className="absolute w-80 right-[6vw] md:right-[8vw] -translate-y-36 z-20 invert dark:invert-0 drop-shadow-xl"
          src={chk}
        />
        <img
          draggable={false}
          src={isMobile ? s2 : s1}
          className="w-[90vw] overflow-clip -rotate-12 md:rotate-0 md:w-[80vw] rounded-xl object-cover drop-shadow-2xl drop-shadow-black"
        />
      </div>
      <div className="flex flex-col items-center justify-center gap-2 my-52 pb-14">
        {(() => {
          const Btn = (
            <Button
              className="z-20 p-10 drop-shadow-2xl tracking-wider px-12 bg-primary text-primary-foreground hover:bg-primary-foreground font-ka 
                    text-2xl md:text-3xl hover:text-primary transform hover:scale-110 transition duration-200 ease-out  "
            >
              Start Talking
            </Button>
          );
          return connected ? (
            <NavLink to="/app">{Btn}</NavLink>
          ) : (
            <LoginDialog>{Btn}</LoginDialog>
          );
        })()}
      </div>
      <div className="flex flex-col bg-primary w-full p-6 gap-4">
        {/* <div className="flex flex-col items-center justify-center gap-2">
                    <div className="font-ka text-3xl tracking-widest">Subspace</div>
                </div> */}
        <div className="flex flex-col items-center text-primary-foreground text-center justify-center gap-2">
          <div className="font-ka tracking-widest">
            powered by{" "}
            <Link
              draggable={false}
              target="_blank"
              to="https://x.com/aoTheComputer"
              className="hover:underline underline-offset-8 hover:text-white"
            >
              aoTheComputer
            </Link>
          </div>
        </div>
        {/* @ts-ignore */}
        <div className="text-xs text-primary-foreground/60 font-vipnagorgialla text-center">
          v{__VERSION__}
        </div>
      </div>
    </div>
  );
}
