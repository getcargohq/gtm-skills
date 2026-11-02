import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useCargoApi,
  type CargoIdentity,
} from "@cargo-ai/app-sdk";
import { useGetIdentity, useLogout, useMenu } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, LayoutGrid, LogOut } from "lucide-react";
import React from "react";
import { Link, useLocation } from "react-router-dom";

const isActive = (route: string | undefined, path: string): boolean => {
  if (route === undefined) {
    return false;
  }
  if (route === path) {
    return true;
  }
  return route !== "/" && path.startsWith(`${route}/`);
};

// Who is signed in, and to which workspace, in one place at the foot of the
// sidebar. The menu holds the email and Log out.
const UserFooter: React.FC = () => {
  const api = useCargoApi();
  const { data: identity } = useGetIdentity<CargoIdentity>();
  const { mutate: logout } = useLogout();

  const workspace = useQuery({
    queryKey: ["workspace"],
    queryFn: () => api.workspaceManagement.workspace.getCurrent(),
    staleTime: 60 * 60 * 1000,
  });

  if (identity === undefined) {
    return null;
  }
  let workspaceName = "";
  if (workspace.data !== undefined) {
    workspaceName = workspace.data.workspace.name;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent"
        >
          {identity.avatar === undefined ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {identity.name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <img
              src={identity.avatar}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">
              {identity.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {workspaceName}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{identity.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {identity.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// The sidebar and page frame: navigation from the declared resources, and the
// rep and workspace at the bottom instead of a top bar.
export const AppLayout: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  const { menuItems, selectedKey } = useMenu();
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen min-h-0 w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex h-full w-60 flex-col border-r bg-card">
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-4 text-sm font-semibold"
        >
          <LayoutGrid className="h-5 w-5" />
          {title}
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <ul className="flex flex-col gap-0.5">
            {menuItems.map((item) => {
              const isCurrent =
                selectedKey === item.key || isActive(item.route, pathname);
              let linkClass =
                "text-muted-foreground hover:bg-accent/50 hover:text-foreground";
              if (isCurrent) {
                linkClass = "bg-accent font-medium text-accent-foreground";
              }
              return (
                <li key={item.key}>
                  <Link
                    to={item.route ?? "/"}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${linkClass}`}
                  >
                    <span className="flex h-4 w-4 items-center">
                      {item.icon}
                    </span>
                    {item.label ?? item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t p-2">
          <UserFooter />
        </div>
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
};
