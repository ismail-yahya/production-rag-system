// ---------------------------------------------------------------------------
// Auth layout — no sidebar, no header. Centered content for login/register.
// ---------------------------------------------------------------------------

import { ToastContainer } from "@/components/ui/toast-container";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
