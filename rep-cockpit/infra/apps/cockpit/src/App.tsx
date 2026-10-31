import { CargoRefineApp, TooltipProvider } from "@cargo-ai/app-sdk";
import { Briefcase, Flame } from "lucide-react";
import React from "react";
import { Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { HeldClicksProvider } from "./lib/held";
import { Account } from "./pages/Account";
import { HotAccounts } from "./pages/HotAccounts";
import { MyAccounts } from "./pages/MyAccounts";

const resources = [
  {
    name: "hot-accounts",
    list: "/",
    meta: { label: "Hot accounts", icon: <Flame className="h-4 w-4" /> },
  },
  {
    name: "accounts",
    list: "/accounts",
    show: "/accounts/:domain",
    meta: { label: "My accounts", icon: <Briefcase className="h-4 w-4" /> },
  },
];

export const App: React.FC = () => {
  return (
    <CargoRefineApp resources={resources}>
      <TooltipProvider>
        <HeldClicksProvider>
          <AppLayout title="Rep cockpit">
            <Routes>
              <Route path="/" element={<HotAccounts />} />
              <Route path="/accounts" element={<MyAccounts />} />
              <Route path="/accounts/:domain" element={<Account />} />
            </Routes>
          </AppLayout>
        </HeldClicksProvider>
      </TooltipProvider>
    </CargoRefineApp>
  );
};
