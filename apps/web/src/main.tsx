import { Toast } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Follow the system light/dark setting (HeroUI themes key off .dark / data-theme).
const dark = window.matchMedia("(prefers-color-scheme: dark)");
const applyTheme = () => document.documentElement.classList.toggle("dark", dark.matches);
applyTheme(); dark.addEventListener("change", applyTheme);

const queries = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode><QueryClientProvider client={queries}><App /><Toast.Provider placement="bottom" /></QueryClientProvider></StrictMode>,
);
