import { CargoRefineApp, CargoSiderLayout } from "@cargo-ai/app-sdk";
import { Briefcase, Flame } from "lucide-react";
import React from "react";
import { Route, Routes } from "react-router-dom";

import { HeldClicksProvider } from "./lib/held";
import { Account } from "./pages/Account";
import { HotLeads } from "./pages/HotLeads";
import { MyAccounts } from "./pages/MyAccounts";

const resources = [
  {
    name: "hot-leads",
    list: "/",
    meta: { label: "Hot leads", icon: <Flame className="h-4 w-4" /> },
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
      <HeldClicksProvider>
        <CargoSiderLayout title="Rep cockpit">
          <Routes>
            <Route path="/" element={<HotLeads />} />
            <Route path="/accounts" element={<MyAccounts />} />
            <Route path="/accounts/:domain" element={<Account />} />
          </Routes>
        </CargoSiderLayout>
      </HeldClicksProvider>
    </CargoRefineApp>
  );
};
