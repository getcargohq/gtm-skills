import {
  CargoErrorBoundary,
  CargoRefineApp,
  CargoSiderLayout,
} from "@cargo-ai/app-sdk";
import { Building2, FileText, Users } from "lucide-react";
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Accounts } from "./pages/Accounts";
import { People } from "./pages/People";
import { Posts } from "./pages/Posts";

const resources = [
  {
    name: "people",
    list: "/people",
    meta: { label: "People", icon: <Users className="h-4 w-4" /> },
  },
  {
    name: "accounts",
    list: "/accounts",
    meta: { label: "Accounts", icon: <Building2 className="h-4 w-4" /> },
  },
  {
    name: "posts",
    list: "/posts",
    meta: { label: "Posts", icon: <FileText className="h-4 w-4" /> },
  },
];

export const App: React.FC = () => {
  return (
    <CargoRefineApp resources={resources}>
      <CargoSiderLayout title="Engagement Board">
        <CargoErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/people" replace />} />
            <Route path="/people" element={<People />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/posts" element={<Posts />} />
          </Routes>
        </CargoErrorBoundary>
      </CargoSiderLayout>
    </CargoRefineApp>
  );
};
