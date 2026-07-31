'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, whoami } from '@/lib/api/session';
import type { User } from '@/lib/api/types';

/* Who's signed in, in the topbar. The product isn't gated — you can be here
   without a session — so this is either the account or a way to get one. */
export function AccountPill() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    whoami().then((u) => {
      if (!live) return;
      setUser(u);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const out = useCallback(async () => {
    setOpen(false);
    await signOut();
    setUser(null);
    router.push('/login');
  }, [router]);

  if (!ready) return <span className="acct-slot" aria-hidden="true" />;

  if (!user) {
    return (
      <Link className="kbd" href="/login" title="Sign in">
        Sign in
      </Link>
    );
  }

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="acct" ref={wrapRef}>
      <button
        type="button"
        className="acct-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${user.name} · ${user.email}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="acct-initials">{initials}</span>
      </button>
      {open ? (
        <div className="acct-menu" role="menu">
          <div className="acct-who">
            <span className="acct-name">{user.name}</span>
            <span className="acct-mail">{user.email}</span>
            <span className="acct-co">{user.company}</span>
          </div>
          <button type="button" role="menuitem" className="acct-out" onClick={out}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
