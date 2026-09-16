import {
  CargoErrorBoundary,
  CargoRefineApp,
  CargoSiderLayout,
} from "@cargo-ai/app-sdk";
import { Inbox, Linkedin } from "lucide-react";
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { EmailInbox } from "./pages/EmailInbox";
import { LinkedInSend } from "./pages/LinkedInSend";

const resources = [
  {
    name: "inbox",
    list: "/inbox",
    meta: { label: "Inbox", icon: <Inbox className="h-4 w-4" /> },
  },
  {
    name: "linkedin",
    list: "/linkedin",
    meta: { label: "LinkedIn", icon: <Linkedin className="h-4 w-4" /> },
  },
];

export const App: React.FC = () => {
  return (
    <CargoRefineApp resources={resources}>
      <CargoSiderLayout title="Reply inbox">
        <CargoErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/inbox" replace={true} />} />
            <Route path="/inbox" element={<EmailInbox />} />
            <Route path="/linkedin" element={<LinkedInSend />} />
          </Routes>
        </CargoErrorBoundary>
      </CargoSiderLayout>
    </CargoRefineApp>
  );
};
