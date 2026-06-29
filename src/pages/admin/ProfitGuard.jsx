import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import ProfitPinGate from '../../components/admin/ProfitPinGate'
import { verifyProfitPin } from '../../api/admin'
import { useNotify } from '../../context/NotifyContext'

/**
 * PIN gate for the ENTIRE /admin/profits section (list + per-order breakdown).
 *
 * The verified PIN lives ONLY in this component's memory — it is never written to
 * sessionStorage/localStorage. React Router keeps this layout mounted while the
 * user moves between the list and a breakdown (same mount → PIN preserved), but
 * unmounts it the moment they navigate anywhere outside /admin/profits. So:
 *   • entering the section — or opening a /admin/profits/:id URL directly — always
 *     shows the PIN screen first (no bypass);
 *   • leaving the section clears the PIN, so coming back (including via browser
 *     Back / Forward) requires the PIN again.
 *
 * Children read the verified PIN via useOutletContext().
 */
export default function ProfitGuard() {
  const { error } = useNotify()
  const [pin, setPin] = useState('')
  const [verifiedPin, setVerifiedPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [gateError, setGateError] = useState('')

  const submit = async (e) => {
    e?.preventDefault()
    if (loading || pin.length !== 4) return
    setGateError('')
    setLoading(true)
    try {
      await verifyProfitPin(pin)
      setVerifiedPin(pin)
    } catch (err) {
      if (err.status === 401) setGateError('Ghalat PIN. Dobara koshish karein.')
      else error(err.message || 'Verify nahi hua')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // Let a child re-lock the section if the server ever rejects the PIN mid-session.
  const relock = () => {
    setVerifiedPin('')
    setPin('')
    setGateError('')
  }

  if (!verifiedPin) {
    return (
      <ProfitPinGate
        pin={pin}
        setPin={setPin}
        onSubmit={submit}
        error={gateError}
        loading={loading}
        title="Profit Analytics"
      />
    )
  }

  return <Outlet context={{ profitPin: verifiedPin, relock }} />
}
