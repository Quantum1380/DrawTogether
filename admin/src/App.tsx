import { HashRouter } from "react-router-dom";
import { AuthProvider } from "@/store/auth";
import AppRoutes from "@/routes";
import "@/styles/global.scss";
export default function App() {
  return (
    <AuthProvider>
      {" "}
      <HashRouter>
        {" "}
        <AppRoutes />{" "}
      </HashRouter>{" "}
    </AuthProvider>
  );
}
