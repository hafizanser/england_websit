import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// "Is this render a Back/Forward into a page this session has already shown?"
//
// It is the question the data cache turns on: a restore is served silently from
// what we already have, while every other arrival paints from cache AND checks
// with the server, so an admin's edit is never more than one navigation away.
//
// `useNavigationType() === 'POP'` alone is not the answer. react-router reports
// the app's very first render as a POP too, so a cold load would look like a
// restore and never check for updates.
//
// Nor is the trick `useScrollRestoring` uses — ignoring the entry react-router
// labels `'default'`. That label belongs to the entry the app BOOTED on, and it
// keeps it for the whole session: a shopper who opens /#/products directly, taps
// a product and presses Back is landing on `'default'`, and calling that "not a
// restore" gets the one case this all exists for wrong. (For scroll restoration
// the same shortcut is harmless — the boot entry has no remembered position to
// restore — which is why the two ask the question differently.)
//
// So: remember which history entries this session has actually rendered, and let
// a POP into one of them be a restore. A reload starts with an empty set, so a
// refresh correctly checks the server; a genuine Back never does.
const seen = new Set()

// A long browsing session is a few dozen entries. The cap only exists so an
// automated crawl cannot grow this without bound.
const MAX_TRACKED = 200

export function useRestoreNavigation() {
  const location = useLocation()
  const navType = useNavigationType()
  const key = location.key || 'default'

  // Read during render, BEFORE the effect below records this entry — every hook
  // in a commit renders before any effect runs, so they all agree on whether the
  // entry was known before this navigation.
  const isRestore = navType === 'POP' && seen.has(key)

  useEffect(() => {
    if (seen.size >= MAX_TRACKED) seen.clear()
    seen.add(key)
  }, [key])

  return isRestore
}
