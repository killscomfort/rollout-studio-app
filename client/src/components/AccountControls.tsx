import { useEffect, useState } from "react";
import { getSession } from "../lib/supabase";
import { isAdminEmail } from "../lib/admin-access";
import * as supabaseStore from "../data/supabase-store";

export function AccountControls() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void getSession()
      .then((session) => {
        setEmail(session?.user.email ?? null);
      })
      .catch(() => {
        setEmail(null);
      });
  }, []);

  if (!email) return null;

  return (
    <div className="account-controls">
      <span className="account-email">{email}</span>
      {isAdminEmail(email) ? (
        <a className="button ghost" href="#admin">
          Admin
        </a>
      ) : null}
      <button
        type="button"
        className="button ghost"
        onClick={() => void supabaseStore.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
