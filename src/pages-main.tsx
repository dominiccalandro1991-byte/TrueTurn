import "./pages-shim";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashHistory } from "@tanstack/history";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultErrorComponent: AppErrorComponent,
});

const el = document.getElementById("pages-root");
if (!el) throw new Error("pages-root missing");
createRoot(el).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
