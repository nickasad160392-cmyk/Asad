import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// Set URL backend Replit agar APK bisa konek ke server
setBaseUrl("https://asad--nickasad160392.replit.app");

setAuthTokenGetter(() => {
  return sessionStorage.getItem("absensi_token") || localStorage.getItem("absensi_token");
});

createRoot(document.getElementById("root")!).render(<App />);
